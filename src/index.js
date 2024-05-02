import DataDogLoggingService from './DataDogLoggingService';
import NewRelicLoggingService from './NewRelicLoggingService';
import {
  configureLoggingService,
  logApiClientError,
  logAPIErrorResponse,
  processApiClientError,
  logInfo,
  logError,
} from './logging';

export {
  configureLoggingService,
  logApiClientError,
  logAPIErrorResponse,
  processApiClientError,
  logInfo,
  logError,
  NewRelicLoggingService,
  DataDogLoggingService,
};
