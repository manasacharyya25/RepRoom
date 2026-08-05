import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.rhoq.mobile',
  appName: 'RhoQ',
  webDir: 'out',

  server: {
    url: 'https://rhoq.app',
    cleartext: false,

    allowNavigation: [
      'rhoq.app',
      '*.rhoq.app'
    ]
  }
};

export default config;
