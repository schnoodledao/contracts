import { ReportHandler } from 'web-vitals/dist/modules/types.js';

const reportWebVitals = (onPerfEntry: ReportHandler): void => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
// ReSharper disable InconsistentNaming
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
// ReSharper restore InconsistentNaming
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
