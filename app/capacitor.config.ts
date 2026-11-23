import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.edu.iot.dungeonlink',
  appName: 'DungeonLink',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Procurando DungeonLink-ESP32...',
        cancel: 'Cancelar',
        availableDevices: 'Dispositivos BLE encontrados',
        noDeviceFound: 'Nenhum ESP32 DungeonLink encontrado',
      },
    },
  },
};

export default config;
