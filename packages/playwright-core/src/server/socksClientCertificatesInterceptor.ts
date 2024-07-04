/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type net from 'net';
import path from 'path';
import type https from 'https';
import fs from 'fs';
import tls from 'tls';
import stream from 'stream';
import { createSocket } from '../utils/happy-eyeballs';
import { assert, isUnderTest, urlMatches } from '../utils';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from '../common/socksProxy';
import { SocksProxy } from '../common/socksProxy';
import type * as channels from '@protocol/channels';

class SocksConnectionDuplex extends stream.Duplex {
  constructor(private readonly writeCallback: (data: Buffer) => void) {
    super();
  }
  override _read(): void {}
  override _write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
    this.writeCallback(chunk);
    callback();
  }
}

class SocksProxyConnection {
  firstPackageReceived: boolean = false;
  isTLS: boolean = false;

  target: net.Socket = null!;

  // In case of http, we just pipe data to the target socket and they are |undefined|.
  internal: stream.Duplex | undefined;
  internalTLS: tls.TLSSocket | undefined;

  constructor(private readonly socksProxy: ClientCertificatesProxy, private readonly uid: string, private readonly host: string, private readonly port: number) {}

  async connect() {
    // WebKit on Darwin doesn't proxy localhost requests through the given proxy.
    // Workaround: Rewrite to localhost during tests.
    this.target = await createSocket(isUnderTest() ? 'localhost' : this.host, this.port);
    this.target.on('close', () => this.socksProxy._socksProxy.sendSocketEnd({ uid: this.uid }));
    this.target.on('error', error => this.socksProxy._socksProxy.sendSocketError({ uid: this.uid, error: error.message }));
    this.socksProxy._socksProxy.socketConnected({
      uid: this.uid,
      host: this.target.localAddress!,
      port: this.target.localPort!,
    });
  }

  public onClose() {
    this.internal?.destroy();
    this.target.destroy();
  }

  public onData(data: Buffer) {
    // HTTP / TLS are client-hello based protocols. This allows us to detect
    // the protocol on the first package and attach appropriate listeners.
    if (!this.firstPackageReceived) {
      this.firstPackageReceived = true;
      // 0x16 is SSLv3/TLS "handshake" content type: https://en.wikipedia.org/wiki/Transport_Layer_Security#TLS_record
      this.isTLS = data[0] === 0x16;
      if (this.isTLS)
        this._attachTLSListeners();
      else
        this.target.on('data', data => this.socksProxy._socksProxy.sendSocketData({ uid: this.uid, data }));
    }
    if (this.isTLS)
      this.internal!.push(data);
    else
      this.target.write(data);
  }

  private _attachTLSListeners() {
    assert(this.isTLS);

    this.internal = new SocksConnectionDuplex(data => this.socksProxy._socksProxy.sendSocketData({ uid: this.uid, data }));
    this.internalTLS = new tls.TLSSocket(this.internal, {
      isServer: true,
      // openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509 -keyout key.pem -out cert.pem -subj "/CN=localhost"
      key: fs.readFileSync(path.join(__dirname, '../../bin/socks-certs/key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '../../bin/socks-certs/cert.pem')),
    });
    this.internalTLS.on('close', () => this.socksProxy._socksProxy.sendSocketEnd({ uid: this.uid }));

    const targetTLS = tls.connect({
      socket: this.target,
      rejectUnauthorized: this.socksProxy.contextOptions.ignoreHTTPSErrors === true ? false : true,
      ...clientCertificatesToTLSOptions(this.socksProxy.contextOptions.clientCertificates, `https://${this.host}:${this.port}/`),
    });

    this.internalTLS.pipe(targetTLS);
    targetTLS.pipe(this.internalTLS);

    // Handle close and errors
    const closeBothSockets = () => {
      this.internalTLS?.end();
      targetTLS.end();
    };

    this.internalTLS.on('end', () => closeBothSockets());
    targetTLS.on('end', () => closeBothSockets());

    this.internalTLS.on('error', () => closeBothSockets());
    targetTLS.on('error', error => {
      if (['DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED'].includes(error.code)) {
        this.internalTLS!.write('HTTP/1.1 503 Internal Server Error\r\n');
        this.internalTLS!.write('Content-Type: text/html; charset=utf-8\r\n');
        const responseBody = 'Self-signed certificate error: ' + error.message;
        this.internalTLS!.write('Content-Length: ' + Buffer.byteLength(responseBody) + '\r\n');
        this.internalTLS!.write('\r\n');
        this.internalTLS!.write(responseBody);
        this.internalTLS!.end();
        return;
      }
      closeBothSockets();
    });
  }
}

export class ClientCertificatesProxy {
  _socksProxy: SocksProxy;
  private _connections: Map<string, SocksProxyConnection> = new Map();

  constructor(
    public readonly contextOptions: Pick<channels.BrowserNewContextOptions, 'clientCertificates' | 'ignoreHTTPSErrors'>
  ) {
    this._socksProxy = new SocksProxy();
    this._socksProxy.setPattern('*');
    this._socksProxy.addListener(SocksProxy.Events.SocksRequested, async (payload: SocksSocketRequestedPayload) => {
      try {
        const connection = new SocksProxyConnection(this, payload.uid, payload.host, payload.port);
        await connection.connect();
        this._connections.set(payload.uid, connection);
      } catch (error) {
        this._socksProxy.socketFailed({ uid: payload.uid, errorCode: error.code });
      }
    });
    this._socksProxy.addListener(SocksProxy.Events.SocksData, async (payload: SocksSocketDataPayload) => {
      this._connections.get(payload.uid)?.onData(payload.data);
    });
    this._socksProxy.addListener(SocksProxy.Events.SocksClosed, (payload: SocksSocketClosedPayload) => {
      this._connections.get(payload.uid)?.onClose();
      this._connections.delete(payload.uid);
    });
  }

  public async listen(): Promise<string> {
    return `socks5://127.0.0.1:${await this._socksProxy.listen(0)}`;
  }

  public async close() {
    await this._socksProxy.close();
  }
}

export function clientCertificatesToTLSOptions(
  clientCertificates: channels.BrowserNewContextOptions['clientCertificates'],
  requestURL: string
): Pick<https.RequestOptions, 'pfx' | 'key' | 'passphrase' | 'cert' | 'ca'> | undefined {
  const matchingCerts = clientCertificates?.filter(c => urlMatches(undefined, requestURL, c.url));
  if (!matchingCerts || !matchingCerts.length)
    return;
  const requestOptions = {
    pfx: [] as { buf: Buffer, passphrase?: string }[],
    key: [] as { pem: Buffer, passphrase?: string }[],
    cert: [] as Buffer[],
  };
  for (const { certs } of matchingCerts) {
    for (const cert of certs) {
      if (cert.cert)
        requestOptions.cert.push(cert.cert);
      if (cert.key)
        requestOptions.key.push({ pem: cert.key, passphrase: cert.passphrase });
      if (cert.pfx)
        requestOptions.pfx.push({ buf: cert.pfx, passphrase: cert.passphrase });
    }
  }
  return requestOptions;
}

export function shouldUseMitmSocksProxy(options: {
  ca?: Buffer[];
  clientCertificates?: channels.BrowserNewContextOptions['clientCertificates'];
}) {
  if (options.clientCertificates && options.clientCertificates.length > 0)
    return true;
  return false;
}
