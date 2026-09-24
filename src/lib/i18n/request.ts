import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Dates and numbers are formatted per locale, but a UNIT is never localised
    // into another unit. 12,400 hectare-years is 12.400 Hektarjahre in German -
    // the separator changes, the quantity and the unit never do.
    timeZone: 'Europe/Brussels',
    formats: {
      dateTime: {
        short: { day: '2-digit', month: 'short', year: 'numeric' },
        long: { day: 'numeric', month: 'long', year: 'numeric' },
      },
      number: {
        volume: { maximumFractionDigits: 0 },
      },
    },
  };
});
