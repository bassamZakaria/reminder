import { AppRegistry } from 'react-native';
import { registerSW } from 'virtual:pwa-register';
import App from '../../App';
import { installAlertShim } from './alertShim';

const APP_NAME = 'Recall';

installAlertShim();
registerSW({ immediate: true });

AppRegistry.registerComponent(APP_NAME, () => App);
AppRegistry.runApplication(APP_NAME, { rootTag: document.getElementById('root') });
