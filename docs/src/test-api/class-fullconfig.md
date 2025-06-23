# class: FullConfig
* since: v1.10
* langs: js

## property: FullConfig.forbidOnly
* since: v1.10
- type: ?<[boolean]>

See [`property: TestConfig.forbidOnly`].

## property: FullConfig.fullyParallel
* since: v1.20
- type: ?<[boolean]>

See [`property: TestConfig.fullyParallel`].

## property: FullConfig.globalSetup
* since: v1.10
- type: ?<[string]|[Array]<[string]>>

See [`property: TestConfig.globalSetup`].

## property: FullConfig.globalTeardown
* since: v1.10
- type: ?<[string]|[Array]<[string]>>

See [`property: TestConfig.globalTeardown`].

## property: FullConfig.globalTimeout
* since: v1.10
- type: ?<[int]>

See [`property: TestConfig.globalTimeout`].

## property: FullConfig.grep
* since: v1.10
- type: ?<[RegExp]|[Array]<[RegExp]>>

See [`property: TestConfig.grep`].

## property: FullConfig.grepInvert
* since: v1.10
- type: ?<[RegExp]|[Array]<[RegExp]>>

See [`property: TestConfig.grepInvert`].

## property: FullConfig.maxFailures
* since: v1.10
- type: ?<[int]>

See [`property: TestConfig.maxFailures`].

## property: FullConfig.metadata
* since: v1.10
- type: ?<[Metadata]>

See [`property: TestConfig.metadata`].

## property: FullConfig.preserveOutput
* since: v1.10
- type: ?<[PreserveOutput]<"always"|"never"|"failures-only">>

See [`property: TestConfig.preserveOutput`].

## property: FullConfig.projects
* since: v1.10
- type: ?<[Array]<[TestProject]>>

See [`property: TestConfig.projects`].

## property: FullConfig.quiet
* since: v1.10
- type: ?<[boolean]>

See [`property: TestConfig.quiet`].

## property: FullConfig.reporter
* since: v1.10
- type: ?<[string]|[Array]<[Object]>|[BuiltInReporter]<"list"|"dot"|"line"|"github"|"json"|"junit"|"null"|"html">>
  - `0` <[string]> Reporter name or module or file path
  - `1` <[Object]> An object with reporter options if any

See [`property: TestConfig.reporter`].

## property: FullConfig.reportSlowTests
* since: v1.10
- type: ?<[null]|[Object]>
  - `max` <[int]> The maximum number of slow test files to report. Defaults to `5`.
  - `threshold` <[float]> Test file duration in milliseconds that is considered slow. Defaults to 5 minutes.

See [`property: TestConfig.reportSlowTests`].

## property: FullConfig.shard
* since: v1.10
- type: ?<[null]|[Object]>
  - `current` <[int]> The index of the shard to execute, one-based.
  - `total` <[int]> The total number of shards.

See [`property: TestConfig.shard`].

## property: FullConfig.updateSnapshots
* since: v1.10
- type: ?<[UpdateSnapshots]<"all"|"changed"|"missing"|"none">>

See [`property: TestConfig.updateSnapshots`].

## property: FullConfig.webServer
* since: v1.10
- type: ?<[Object]|[Array]<[Object]>>
  - `command` <[string]> Shell command to start. For example `npm run start`..
  - `cwd` ?<[string]> Current working directory of the spawned process, defaults to the directory of the configuration file.
  - `env` ?<[Object]<[string], [string]>> Environment variables to set for the command, `process.env` by default.
  - `gracefulShutdown` ?<[Object]> How to shut down the process. If unspecified, the process group is forcefully `SIGKILL`ed. If set to `{ signal: 'SIGTERM', timeout: 500 }`, the process group is sent a `SIGTERM` signal, followed by `SIGKILL` if it doesn't exit within 500ms. You can also use `SIGINT` as the signal instead. A `0` timeout means no `SIGKILL` will be sent. Windows doesn't support `SIGTERM` and `SIGINT` signals, so this option is ignored on Windows. Note that shutting down a Docker container requires `SIGTERM`.
    - `signal` <["SIGINT"|"SIGTERM"]>
    - `timeout` <[int]>
  - `ignoreHTTPSErrors` ?<[boolean]> Whether to ignore HTTPS errors when fetching the `url`. Defaults to `false`.
  - `name` ?<[string]> Specifies a custom name for the web server. This name will be prefixed to log messages. Defaults to `[WebServer]`.
  - `port` ?<[int]> The port that your http server is expected to appear on. It does wait until it accepts connections. Either `port` or `url` should be specified.
  - `reuseExistingServer` ?<[boolean]> If true, it will re-use an existing server on the `port` or `url` when available. If no server is running on that `port` or `url`, it will run the command to start a new server. If `false`, it will throw if an existing process is listening on the `port` or `url`. This should be commonly set to `!process.env.CI` to allow the local dev server when running tests locally.
  - `stderr` ?<["pipe"|"ignore"]> Whether to pipe the stderr of the command to the process stderr or ignore it. Defaults to `"pipe"`.
  - `stdout` ?<["pipe"|"ignore"]> If `"pipe"`, it will pipe the stdout of the command to the process stdout. If `"ignore"`, it will ignore the stdout of the command. Default to `"ignore"`.
  - `timeout` ?<[int]> How long to wait for the process to start up and be available in milliseconds. Defaults to 60000.
  - `url` ?<[string]> The url on your http server that is expected to return a 2xx, 3xx, 400, 401, 402, or 403 status code when the server is ready to accept connections. Redirects (3xx status codes) are being followed and the new location is checked. Either `port` or `url` should be specified.

See [`property: TestConfig.webServer`].

## property: FullConfig.workers
* since: v1.10
- type: ?<[int]|[string]>

See [`property: TestConfig.workers`].
