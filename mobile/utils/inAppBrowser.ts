import * as WebBrowser from 'expo-web-browser';

export const openInAppBrowser = async (url: string) => {
  const finalUrl = url.startsWith('http') ? url : `https://${url}`;
  try {
    await WebBrowser.warmUpAsync();
    await WebBrowser.openBrowserAsync(finalUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.OVER_FULL_SCREEN,
      controlsColor: '#1F2ABF',
      showTitle: true,
      enableBarCollapsing: true,
      dismissButtonStyle: 'close',
    });
    await WebBrowser.coolDownAsync();
  } catch (error) {
    console.error('Failed to open in-app browser', error);
  }
};
