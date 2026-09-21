import { Alert, type AlertButton } from 'react-native';

enum ButtonStyle {
  Cancel = 'cancel',
}

function alertOnWeb(title: string, message?: string, buttons?: AlertButton[]) {
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons ?? []).filter(b => b.style !== ButtonStyle.Cancel);
  const cancel = (buttons ?? []).find(b => b.style === ButtonStyle.Cancel);
  if (!cancel && actions.length <= 1) {
    window.alert(text);
    actions[0]?.onPress?.();
    return;
  }
  if (window.confirm(text)) {
    actions[actions.length - 1]?.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}

export function installAlertShim() {
  Alert.alert = alertOnWeb as typeof Alert.alert;
}
