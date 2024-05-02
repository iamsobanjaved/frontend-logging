export const MAX_ERROR_LENGTH = 4000;

function fixErrorLength(error) {
  if (error.message && error.message.length > MAX_ERROR_LENGTH) {
    const processedError = Object.create(error);
    processedError.message = processedError.message.substring(0, MAX_ERROR_LENGTH);
    return processedError;
  }
  if (typeof error === 'string' && error.length > MAX_ERROR_LENGTH) {
    return error.substring(0, MAX_ERROR_LENGTH);
  }
  return error;
}

const pageActionNameInfo = 'INFO';
const pageActionNameIgnoredError = 'IGNORED_ERROR';

function sendPageAction(actionName, message, customAttributes) {
  if (process.env.NODE_ENV === 'development') {
    console.log(actionName, message, customAttributes); // eslint-disable-line
  }
  if (window && typeof window.datadog !== 'undefined') {
    // https://docs.newrelic.com/docs/browser/new-relic-browser/browser-apis/addpageaction/
    window.datadog.log(message, customAttributes);
  }
}

function sendError(error, customAttributes) {
  if (process.env.NODE_ENV === 'development') {
    console.error(error, customAttributes); // eslint-disable-line
  }
  if (window && typeof window.datadog !== 'undefined') {
    // https://docs.datadoghq.com/real_user_monitoring/browser/collecting_browser_errors/?tab=npm#collect-errors-manually
    window.datadog.error(fixErrorLength(error), customAttributes);
  }
}

function setCustomAttribute(name, value) {
  if (process.env.NODE_ENV === 'development') {
    console.log(name, value); // eslint-disable-line
  }
  if (window && typeof window.newrelic !== 'undefined') {
    // https://docs.newrelic.com/docs/browser/new-relic-browser/browser-apis/setcustomattribute/
    window.newrelic.setCustomAttribute(name, value);
  }
}

/**
 * The NewRelicLoggingService is a concrete implementation of the logging service interface that
 * sends messages to NewRelic that can be seen in NewRelic Browser and NewRelic Insights. When in
 * development mode, all messages will instead be sent to the console.
 *
 * When you use `logError`, your errors will be checked to see if they're ignored *or* not.
 * Not-ignored errors will appear under "JS errors" for your Browser application.
 *
 * ```
 * SELECT * from JavaScriptError WHERE errorStatus is not null SINCE 10 days ago
 * ```
 *
 * Ignored errors will appear in New Relic Insights as page actions, which can be queried:
 *
 * ```
 * SELECT * from PageAction WHERE actionName = 'IGNORED_ERROR' SINCE 1 hour ago
 * ```
 *
 * When using `logInfo`, these only appear in New Relic Insights when querying for page actions as
 * follows:
 *
 * ```
 * SELECT * from PageAction WHERE actionName = 'INFO' SINCE 1 hour ago
 * ```
 *
 * You can also add your own custom metrics as an additional argument, or see the code to find
 * other standard custom attributes. By default, userId is added (via setCustomAttribute) for logged
 * in users via the auth service (AuthAxiosJwtService).
 *
 * Requires the NewRelic Browser JavaScript snippet.
 *
 * @implements {LoggingService}
 * @memberof module:Logging
 */
export default class DatadogLoggingService {
  constructor(options) {
    const config = options ? options.config : undefined;
    /*
        String which is an explicit error message regex. If an error message matches the regex, the error
        is considered an *ignored* error and submitted to New Relic as a page action - not an error.

        Ignored error regexes are configured per frontend application (MFE).

        The regex for all ignored errors are represented in the .env files as a single string. If you need to
        ignore multiple errors, use the standard `|` regex syntax.

        For example, here's a .env line which ignores two specific errors:

        IGNORED_ERROR_REGEX='^\\[frontend-auth\\] Unimportant Error|Specific non-critical error #[\\d]+'

        This example would ignore errors with the following messages:

        [frontend-app-generic] - Specific non-critical error #45678 happened.
        [frontend-app-generic] - Specific non-critical error #93475 happened.
        [frontend-auth] Unimportant Error: Browser strangeness occurred.

        To test your regex additions, use a JS CLI environment (such as node) and run code like this:

        x = new RegExp('^\\[frontend-auth\\] Unimportant Error|Specific non-critical error #[\\d]+');
        '[frontend-app-generic] - Specific non-critical error #45678 happened.'.match(x);
        '[frontend-auth] Unimportant Error: Browser strangeness occurred.'.match(x);
        'This error should not match anything!'.match(x);

        For edx.org, add new error message regexes in edx-internal YAML as needed.
    */
    this.ignoredErrorRegexes = config ? config.IGNORED_ERROR_REGEX : undefined;
  }

  /**
   *
   *
   * @param {*} infoStringOrErrorObject
   * @param {*} [customAttributes={}]
   * @memberof DatadogLoggingService
   */
  logInfo(infoStringOrErrorObject, customAttributes = {}) {
    let message = infoStringOrErrorObject;
    // let customAttrs = customAttributes;
    if (typeof infoStringOrErrorObject === 'object' && 'message' in infoStringOrErrorObject) {
      // const infoCustomAttributes = infoStringOrErrorObject.customAttributes || {};
      // customAttrs = { ...infoCustomAttributes, ...customAttributes };
      message = infoStringOrErrorObject.message;
    }
    window.datadog.info(message, customAttributes);
  }

  /**
   *
   *
   * @param {*} errorStringOrObject
   * @param {*} [customAttributes={}]
   * @memberof DatadogLoggingService
   */
  logError(errorStringOrObject, customAttributes = {}) {
    const errorCustomAttributes = errorStringOrObject.customAttributes || {};
    let allCustomAttributes = { ...errorCustomAttributes, ...customAttributes };
    if (Object.keys(allCustomAttributes).length === 0) {
      // noticeError expects undefined if there are no custom attributes.
      allCustomAttributes = undefined;
    }

    /*
        Separate the errors into ignored errors and other errors.
        Ignored errors are logged via adding a page action.
        Other errors are logged via noticeError and count as "JS Errors" for the application.
    */
    const errorMessage = errorStringOrObject.message || (typeof errorStringOrObject === 'string' ? errorStringOrObject : '');
    if (this.ignoredErrorRegexes && errorMessage.match(this.ignoredErrorRegexes)) {
      /* ignored error */
      sendPageAction(pageActionNameIgnoredError, errorMessage, allCustomAttributes);
    } else {
      /*  error! */
      sendError(errorStringOrObject, allCustomAttributes);
    }
  }

  /**
   * Sets a custom attribute that will be included with all subsequent log messages.
   *
   * @param {string} name
   * @param {string|number|null} value
   */
  setCustomAttribute(name, value) {
    setCustomAttribute(name, value);
  }
}
