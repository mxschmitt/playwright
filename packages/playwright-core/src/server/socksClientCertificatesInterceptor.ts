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
import { createSocket } from '../utils/happy-eyeballs';
import { urlMatches } from '../utils';
import type { SocksSocketClosedPayload, SocksSocketDataPayload, SocksSocketRequestedPayload } from '../common/socksProxy';
import { SocksProxy } from '../common/socksProxy';
import type * as channels from '@protocol/channels';
import type * as types from './types';

class ProxyConnection {
  firstPackageReceived: boolean = false;
  isTLS: boolean = false;

  constructor(
    readonly hostname: string,
    readonly port: number,
    readonly internal: net.Socket,
    readonly target: net.Socket,
    readonly sendSocketData: (data: Buffer) => void,
  ) {}

  public onClose() {
    this.internal.destroy();
    this.target.destroy();
  }

  public onData(data: Buffer) {
    if (!this.firstPackageReceived) {
      this.firstPackageReceived = true;
      this.isTLS = data[0] === 22;
      if (this.isTLS)
        this.internal.on('data', this.sendSocketData);
      else
        // TODO: We should at this point close the internal connection and only use the target this.
        this.target.on('data', this.sendSocketData);
    }
    if (this.isTLS)
      this.internal.write(data);
    else
      this.target.write(data);
  }
}

export class ClientCertificatesProxy {
  private _socksProxy: SocksProxy;
  private _connections: Map<string, ProxyConnection> = new Map();
  private _tlsServer: tls.Server = null!;
  private _address: string = null!;

  constructor(
    private readonly ignoreHTTPSErrors: boolean | undefined,
    private readonly ca: channels.BrowserNewContextOptions['ca'],
    private readonly clientCertificates: channels.BrowserNewContextOptions['clientCertificates'],
  ) {
    this._socksProxy = new SocksProxy();
    this._socksProxy.setPattern('*');
    this._socksProxy.addListener(SocksProxy.Events.SocksRequested, async (payload: SocksSocketRequestedPayload) => {
      try {
        // We create two connections: one to the internal server and one to the target server.
        // Once we receive the first package, we decide whether to forward the data to the internal server or the target server.
        const internal = await createSocket('127.0.0.1', (this._tlsServer.address() as net.AddressInfo).port);
        const target = await createSocket(payload.host, payload.port);
        const connection = new ProxyConnection(payload.host, payload.port, internal, target, data => this._socksProxy.sendSocketData({ uid: payload.uid, data }));
        this._connections.set(payload.uid, connection);
        internal.on('close', () => this._socksProxy.sendSocketEnd({ uid: payload.uid }));
        internal.on('error', error => this._socksProxy.sendSocketError({ uid: payload.uid, error: error.message }));
        this._socksProxy.socketConnected({
          uid: payload.uid,
          host: connection.target.localAddress!,
          port: connection.target.localPort!,
        });
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

  public async listen(): Promise<void> {
    // TODO: Genereate a self-signed certificate and pass it to Chromium as --ignore-certificate-errors-spki-list
    this._tlsServer = tls.createServer({
      key: fs.readFileSync(path.join(__dirname, '../../../../tests/config/testserver/key.pem')),
      cert: fs.readFileSync(path.join(__dirname, '../../../../tests/config/testserver/cert.pem')),
      passphrase: 'aaaa',
    }, this._onTLSConnect.bind(this));
    await new Promise<void>(resolve => this._tlsServer.listen(0, resolve));
    this._address = `socks5://127.0.0.1:${await this._socksProxy.listen(0)}`;
  }

  public address(): types.ProxySettings {
    return { server: this._address };
  }

  public close() {
    this._tlsServer.close();
    this._socksProxy.close();
  }

  private _onTLSConnect(tlsSocket: tls.TLSSocket) {
    // find the matching connection based on the tlsSocket
    const connection = Array.from(this._connections.values()).find(s => s.internal.remotePort === tlsSocket.localPort);
    if (!connection) {
      tlsSocket.end();
      return;
    }
    const destSocketTLS = tls.connect({
      socket: connection.target,
      rejectUnauthorized: this.ignoreHTTPSErrors === true ? false : true,
      ca: this.ca,
      ...clientCertificatesToTLSOptions(this.clientCertificates, `https://${connection.hostname}:${connection.port}/`),
    });

    tlsSocket.pipe(destSocketTLS);
    destSocketTLS.pipe(tlsSocket);

    // Handle close and errors
    const closeBothSockets = () => {
      tlsSocket.end();
      destSocketTLS.end();
    };

    tlsSocket.on('end', () => closeBothSockets());
    destSocketTLS.on('end', () => closeBothSockets());

    tlsSocket.on('error', () => closeBothSockets());
    destSocketTLS.on('error', error => {
      if (['DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED'].includes(error.code)) {
        tlsSocket.write('HTTP/1.1 503 Internal Server Error\r\n');
        tlsSocket.write('Content-Type: text/html; charset=utf-8\r\n');
        const responseBody = 'Self-signed certificate error: ' + error.message;
        tlsSocket.write('Content-Length: ' + Buffer.byteLength(responseBody) + '\r\n');
        tlsSocket.write('\r\n');
        tlsSocket.write(responseBody);
        tlsSocket.end();
        return;
      }
      closeBothSockets();
    });
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
  if (options.clientCertificates && options.clientCertificates.length)
    return true;
  if (options.ca)
    return true;
  return false;
}
