/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Page, Worker } from '../page';
import { Dispatcher } from './dispatcher';
import { parseError } from '../errors';
import { ArtifactDispatcher } from './artifactDispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { JSHandleDispatcher, parseArgument, serializeResult } from './jsHandleDispatcher';
import { RequestDispatcher } from './networkDispatchers';
import { ResponseDispatcher } from './networkDispatchers';
import { RouteDispatcher, WebSocketDispatcher } from './networkDispatchers';
import { WebSocketRouteDispatcher } from './webSocketRouteDispatcher';
import { SdkObject } from '../instrumentation';
import { urlMatches } from '../../utils/isomorphic/urlMatch';

import type { Artifact } from '../artifact';
import type { BrowserContext } from '../browserContext';
import type { CRCoverage } from '../chromium/crCoverage';
import type { Download } from '../download';
import type { FileChooser } from '../fileChooser';
import type { CallMetadata } from '../instrumentation';
import type { JSHandle } from '../javascript';
import type { BrowserContextDispatcher } from './browserContextDispatcher';
import type { Frame } from '../frames';
import type { RouteHandler } from '../network';
import type { InitScript, PageBinding } from '../page';
import type * as channels from '@protocol/channels';

export class PageDispatcher extends Dispatcher<Page, channels.PageChannel, BrowserContextDispatcher> implements channels.PageChannel {
  _type_EventTarget = true;
  _type_Page = true;
  private _page: Page;
  _subscriptions = new Set<channels.PageUpdateSubscriptionParams['event']>();
  _webSocketInterceptionPatterns: channels.PageSetWebSocketInterceptionPatternsParams['patterns'] = [];
  private _bindings: PageBinding[] = [];
  private _initScripts: InitScript[] = [];
  private _requestInterceptor: RouteHandler;
  private _interceptionUrlMatchers: (string | RegExp)[] = [];
  private _locatorHandlers = new Set<number>();
  private _jsCoverageActive = false;
  private _cssCoverageActive = false;

  static from(parentScope: BrowserContextDispatcher, page: Page): PageDispatcher {
    return PageDispatcher.fromNullable(parentScope, page)!;
  }

  static fromNullable(parentScope: BrowserContextDispatcher, page: Page | undefined): PageDispatcher | undefined {
    if (!page)
      return undefined;
    const result = parentScope.connection.existingDispatcher<PageDispatcher>(page);
    return result || new PageDispatcher(parentScope, page);
  }

  private constructor(parentScope: BrowserContextDispatcher, page: Page) {
    // TODO: theoretically, there could be more than one frame already.
    // If we split pageCreated and pageReady, there should be no main frame during pageCreated.

    // We will reparent it to the page below using adopt.
    const mainFrame = FrameDispatcher.from(parentScope, page.mainFrame());

    super(parentScope, page, 'Page', {
      mainFrame,
      viewportSize: page.emulatedSize()?.viewport,
      isClosed: page.isClosed(),
      opener: PageDispatcher.fromNullable(parentScope, page.opener())
    });

    this.adopt(mainFrame);

    this._page = page;
    this._requestInterceptor = (route, request) => {
      const matchesSome = this._interceptionUrlMatchers.some(urlMatch => urlMatches(this._page.browserContext._options.baseURL, request.url(), urlMatch));
      if (!matchesSome) {
        route.continue({ isFallback: true }).catch(() => {});
        return;
      }
      this._dispatchEvent('route', { route: new RouteDispatcher(RequestDispatcher.from(this.parentScope(), request), route) });
    };

    this.addObjectListener(Page.Events.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });
    this.addObjectListener(Page.Events.Crash, () => this._dispatchEvent('crash'));
    this.addObjectListener(Page.Events.Download, (download: Download) => {
      // Artifact can outlive the page, so bind to the context scope.
      this._dispatchEvent('download', { url: download.url, suggestedFilename: download.suggestedFilename(), artifact: ArtifactDispatcher.from(parentScope, download.artifact) });
    });
    this.addObjectListener(Page.Events.EmulatedSizeChanged, () => this._dispatchEvent('viewportSizeChanged', { viewportSize: page.emulatedSize()?.viewport }));
    this.addObjectListener(Page.Events.FileChooser, (fileChooser: FileChooser) => this._dispatchEvent('fileChooser', {
      element: ElementHandleDispatcher.from(mainFrame, fileChooser.element()),
      isMultiple: fileChooser.isMultiple()
    }));
    this.addObjectListener(Page.Events.FrameAttached, frame => this._onFrameAttached(frame));
    this.addObjectListener(Page.Events.FrameDetached, frame => this._onFrameDetached(frame));
    this.addObjectListener(Page.Events.LocatorHandlerTriggered, (uid: number) => this._dispatchEvent('locatorHandlerTriggered', { uid }));
    this.addObjectListener(Page.Events.WebSocket, webSocket => this._dispatchEvent('webSocket', { webSocket: new WebSocketDispatcher(this, webSocket) }));
    this.addObjectListener(Page.Events.Worker, worker => this._dispatchEvent('worker', { worker: new WorkerDispatcher(this, worker) }));
    this.addObjectListener(Page.Events.Video, (artifact: Artifact) => this._dispatchEvent('video', { artifact: ArtifactDispatcher.from(parentScope, artifact) }));
    if (page.video)
      this._dispatchEvent('video', { artifact: ArtifactDispatcher.from(this.parentScope(), page.video) });
    // Ensure client knows about all frames.
    const frames = page.frameManager.frames();
    for (let i = 1; i < frames.length; i++)
      this._onFrameAttached(frames[i]);
  }

  page(): Page {
    return this._page;
  }

  async exposeBinding(params: channels.PageExposeBindingParams, metadata: CallMetadata): Promise<void> {
    const binding = await this._page.exposeBinding(params.name, !!params.needsHandle, (source, ...args) => {
      // When reusing the context, we might have some bindings called late enough,
      // after context and page dispatchers have been disposed.
      if (this._disposed)
        return;
      const binding = new BindingCallDispatcher(this, params.name, !!params.needsHandle, source, args);
      this._dispatchEvent('bindingCall', { binding });
      return binding.promise();
    });
    this._bindings.push(binding);
  }

  async setExtraHTTPHeaders(params: channels.PageSetExtraHTTPHeadersParams, metadata: CallMetadata): Promise<void> {
    await this._page.setExtraHTTPHeaders(params.headers);
  }

  async reload(params: channels.PageReloadParams, metadata: CallMetadata): Promise<channels.PageReloadResult> {
    return { response: ResponseDispatcher.fromNullable(this.parentScope(), await this._page.reload(metadata, params)) };
  }

  async goBack(params: channels.PageGoBackParams, metadata: CallMetadata): Promise<channels.PageGoBackResult> {
    return { response: ResponseDispatcher.fromNullable(this.parentScope(), await this._page.goBack(metadata, params)) };
  }

  async goForward(params: channels.PageGoForwardParams, metadata: CallMetadata): Promise<channels.PageGoForwardResult> {
    return { response: ResponseDispatcher.fromNullable(this.parentScope(), await this._page.goForward(metadata, params)) };
  }

  async requestGC(params: channels.PageRequestGCParams, metadata: CallMetadata): Promise<channels.PageRequestGCResult> {
    await this._page.requestGC();
  }

  async registerLocatorHandler(params: channels.PageRegisterLocatorHandlerParams, metadata: CallMetadata): Promise<channels.PageRegisterLocatorHandlerResult> {
    const uid = this._page.registerLocatorHandler(params.selector, params.noWaitAfter);
    this._locatorHandlers.add(uid);
    return { uid };
  }

  async resolveLocatorHandlerNoReply(params: channels.PageResolveLocatorHandlerNoReplyParams, metadata: CallMetadata): Promise<void> {
    this._page.resolveLocatorHandler(params.uid, params.remove);
  }

  async unregisterLocatorHandler(params: channels.PageUnregisterLocatorHandlerParams, metadata: CallMetadata): Promise<void> {
    this._page.unregisterLocatorHandler(params.uid);
    this._locatorHandlers.delete(params.uid);
  }

  async emulateMedia(params: channels.PageEmulateMediaParams, metadata: CallMetadata): Promise<void> {
    await this._page.emulateMedia({
      media: params.media,
      colorScheme: params.colorScheme,
      reducedMotion: params.reducedMotion,
      forcedColors: params.forcedColors,
      contrast: params.contrast,
    });
  }

  async setViewportSize(params: channels.PageSetViewportSizeParams, metadata: CallMetadata): Promise<void> {
    await this._page.setViewportSize(params.viewportSize);
  }

  async addInitScript(params: channels.PageAddInitScriptParams, metadata: CallMetadata): Promise<void> {
    this._initScripts.push(await this._page.addInitScript(params.source));
  }

  async setNetworkInterceptionPatterns(params: channels.PageSetNetworkInterceptionPatternsParams, metadata: CallMetadata): Promise<void> {
    const hadMatchers = this._interceptionUrlMatchers.length > 0;
    if (!params.patterns.length) {
      // Note: it is important to remove the interceptor when there are no patterns,
      // because that disables the slow-path interception in the browser itself.
      if (hadMatchers)
        await this._page.removeRequestInterceptor(this._requestInterceptor);
      this._interceptionUrlMatchers = [];
    } else {
      this._interceptionUrlMatchers = params.patterns.map(pattern => pattern.regexSource ? new RegExp(pattern.regexSource, pattern.regexFlags!) : pattern.glob!);
      if (!hadMatchers)
        await this._page.addRequestInterceptor(this._requestInterceptor);
    }
  }

  async setWebSocketInterceptionPatterns(params: channels.PageSetWebSocketInterceptionPatternsParams, metadata: CallMetadata): Promise<void> {
    this._webSocketInterceptionPatterns = params.patterns;
    if (params.patterns.length)
      await WebSocketRouteDispatcher.installIfNeeded(this.connection, this._page);
  }

  async expectScreenshot(params: channels.PageExpectScreenshotParams, metadata: CallMetadata): Promise<channels.PageExpectScreenshotResult> {
    const mask: { frame: Frame, selector: string }[] = (params.mask || []).map(({ frame, selector }) => ({
      frame: (frame as FrameDispatcher)._object,
      selector,
    }));
    const locator: { frame: Frame, selector: string } | undefined = params.locator ? {
      frame: (params.locator.frame as FrameDispatcher)._object,
      selector: params.locator.selector,
    } : undefined;
    return await this._page.expectScreenshot(metadata, {
      ...params,
      locator,
      mask,
    });
  }

  async screenshot(params: channels.PageScreenshotParams, metadata: CallMetadata): Promise<channels.PageScreenshotResult> {
    const mask: { frame: Frame, selector: string }[] = (params.mask || []).map(({ frame, selector }) => ({
      frame: (frame as FrameDispatcher)._object,
      selector,
    }));
    return { binary: await this._page.screenshot(metadata, { ...params, mask }) };
  }

  async close(params: channels.PageCloseParams, metadata: CallMetadata): Promise<void> {
    if (!params.runBeforeUnload)
      metadata.potentiallyClosesScope = true;
    await this._page.close(params);
  }

  async updateSubscription(params: channels.PageUpdateSubscriptionParams): Promise<void> {
    if (params.event === 'fileChooser')
      await this._page.setFileChooserInterceptedBy(params.enabled, this);
    if (params.enabled)
      this._subscriptions.add(params.event);
    else
      this._subscriptions.delete(params.event);
  }

  async keyboardDown(params: channels.PageKeyboardDownParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.down(metadata, params.key);
  }

  async keyboardUp(params: channels.PageKeyboardUpParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.up(metadata, params.key);
  }

  async keyboardInsertText(params: channels.PageKeyboardInsertTextParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.insertText(metadata, params.text);
  }

  async keyboardType(params: channels.PageKeyboardTypeParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.type(metadata, params.text, params);
  }

  async keyboardPress(params: channels.PageKeyboardPressParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.press(metadata, params.key, params);
  }

  async mouseMove(params: channels.PageMouseMoveParams, metadata: CallMetadata): Promise<void> {
    metadata.point = { x: params.x, y: params.y };
    await this._page.mouse.move(metadata, params.x, params.y, params);
  }

  async mouseDown(params: channels.PageMouseDownParams, metadata: CallMetadata): Promise<void> {
    metadata.point = this._page.mouse.currentPoint();
    await this._page.mouse.down(metadata, params);
  }

  async mouseUp(params: channels.PageMouseUpParams, metadata: CallMetadata): Promise<void> {
    metadata.point = this._page.mouse.currentPoint();
    await this._page.mouse.up(metadata, params);
  }

  async mouseClick(params: channels.PageMouseClickParams, metadata: CallMetadata): Promise<void> {
    metadata.point = { x: params.x, y: params.y };
    await this._page.mouse.click(metadata, params.x, params.y, params);
  }

  async mouseWheel(params: channels.PageMouseWheelParams, metadata: CallMetadata): Promise<void> {
    await this._page.mouse.wheel(metadata, params.deltaX, params.deltaY);
  }

  async touchscreenTap(params: channels.PageTouchscreenTapParams, metadata: CallMetadata): Promise<void> {
    metadata.point = { x: params.x, y: params.y };
    await this._page.touchscreen.tap(metadata, params.x, params.y);
  }

  async accessibilitySnapshot(params: channels.PageAccessibilitySnapshotParams, metadata: CallMetadata): Promise<channels.PageAccessibilitySnapshotResult> {
    const rootAXNode = await this._page.accessibility.snapshot({
      interestingOnly: params.interestingOnly,
      root: params.root ? (params.root as ElementHandleDispatcher)._elementHandle : undefined
    });
    return { rootAXNode: rootAXNode || undefined };
  }

  async pdf(params: channels.PagePdfParams, metadata: CallMetadata): Promise<channels.PagePdfResult> {
    if (!this._page.pdf)
      throw new Error('PDF generation is only supported for Headless Chromium');
    const buffer = await this._page.pdf(params);
    return { pdf: buffer };
  }

  async snapshotForAI(params: channels.PageSnapshotForAIParams, metadata: CallMetadata): Promise<channels.PageSnapshotForAIResult> {
    return { snapshot: await this._page.snapshotForAI(metadata) };
  }

  async bringToFront(params: channels.PageBringToFrontParams, metadata: CallMetadata): Promise<void> {
    await this._page.bringToFront();
  }

  async startJSCoverage(params: channels.PageStartJSCoverageParams, metadata: CallMetadata): Promise<void> {
    this._jsCoverageActive = true;
    const coverage = this._page.coverage as CRCoverage;
    await coverage.startJSCoverage(params);
  }

  async stopJSCoverage(params: channels.PageStopJSCoverageParams, metadata: CallMetadata): Promise<channels.PageStopJSCoverageResult> {
    const coverage = this._page.coverage as CRCoverage;
    const result = await coverage.stopJSCoverage();
    this._jsCoverageActive = false;
    return result;
  }

  async startCSSCoverage(params: channels.PageStartCSSCoverageParams, metadata: CallMetadata): Promise<void> {
    this._cssCoverageActive = true;
    const coverage = this._page.coverage as CRCoverage;
    await coverage.startCSSCoverage(params);
  }

  async stopCSSCoverage(params: channels.PageStopCSSCoverageParams, metadata: CallMetadata): Promise<channels.PageStopCSSCoverageResult> {
    const coverage = this._page.coverage as CRCoverage;
    const result = await coverage.stopCSSCoverage();
    this._cssCoverageActive = false;
    return result;
  }

  _onFrameAttached(frame: Frame) {
    this._dispatchEvent('frameAttached', { frame: FrameDispatcher.from(this.parentScope(), frame) });
  }

  _onFrameDetached(frame: Frame) {
    this._dispatchEvent('frameDetached', { frame: FrameDispatcher.from(this.parentScope(), frame) });
  }

  override _onDispose() {
    // Avoid protocol calls for the closed page.
    if (this._page.isClosedOrClosingOrCrashed())
      return;

    // Cleanup properly and leave the page in a good state. Other clients may still connect and use it.
    this._interceptionUrlMatchers = [];
    this._page.removeRequestInterceptor(this._requestInterceptor).catch(() => {});
    this._page.removeExposedBindings(this._bindings).catch(() => {});
    this._bindings = [];
    this._page.removeInitScripts(this._initScripts).catch(() => {});
    this._initScripts = [];
    for (const uid of this._locatorHandlers)
      this._page.unregisterLocatorHandler(uid);
    this._locatorHandlers.clear();
    this._page.setFileChooserInterceptedBy(false, this).catch(() => {});
    if (this._jsCoverageActive)
      (this._page.coverage as CRCoverage).stopJSCoverage().catch(() => {});
    this._jsCoverageActive = false;
    if (this._cssCoverageActive)
      (this._page.coverage as CRCoverage).stopCSSCoverage().catch(() => {});
    this._cssCoverageActive = false;
  }
}


export class WorkerDispatcher extends Dispatcher<Worker, channels.WorkerChannel, PageDispatcher | BrowserContextDispatcher> implements channels.WorkerChannel {
  _type_Worker = true;

  static fromNullable(scope: PageDispatcher | BrowserContextDispatcher, worker: Worker | null): WorkerDispatcher | undefined {
    if (!worker)
      return undefined;
    const result = scope.connection.existingDispatcher<WorkerDispatcher>(worker);
    return result || new WorkerDispatcher(scope, worker);
  }

  constructor(scope: PageDispatcher | BrowserContextDispatcher, worker: Worker) {
    super(scope, worker, 'Worker', {
      url: worker.url
    });
    this.addObjectListener(Worker.Events.Close, () => this._dispatchEvent('close'));
  }

  async evaluateExpression(params: channels.WorkerEvaluateExpressionParams, metadata: CallMetadata): Promise<channels.WorkerEvaluateExpressionResult> {
    return { value: serializeResult(await this._object.evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: channels.WorkerEvaluateExpressionHandleParams, metadata: CallMetadata): Promise<channels.WorkerEvaluateExpressionHandleResult> {
    return { handle: JSHandleDispatcher.fromJSHandle(this, await this._object.evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg))) };
  }
}

export class BindingCallDispatcher extends Dispatcher<SdkObject, channels.BindingCallChannel, PageDispatcher | BrowserContextDispatcher> implements channels.BindingCallChannel {
  _type_BindingCall = true;
  private _resolve: ((arg: any) => void) | undefined;
  private _reject: ((error: any) => void) | undefined;
  private _promise: Promise<any>;

  constructor(scope: PageDispatcher, name: string, needsHandle: boolean, source: { context: BrowserContext, page: Page, frame: Frame }, args: any[]) {
    const frameDispatcher = FrameDispatcher.from(scope.parentScope(), source.frame);
    super(scope, new SdkObject(scope._object, 'bindingCall'), 'BindingCall', {
      frame: frameDispatcher,
      name,
      args: needsHandle ? undefined : args.map(serializeResult),
      handle: needsHandle ? ElementHandleDispatcher.fromJSOrElementHandle(frameDispatcher, args[0] as JSHandle) : undefined,
    });
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  promise() {
    return this._promise;
  }

  async resolve(params: channels.BindingCallResolveParams, metadata: CallMetadata): Promise<void> {
    this._resolve!(parseArgument(params.result));
    this._dispose();
  }

  async reject(params: channels.BindingCallRejectParams, metadata: CallMetadata): Promise<void> {
    this._reject!(parseError(params.error));
    this._dispose();
  }
}
