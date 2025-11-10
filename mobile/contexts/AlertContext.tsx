import React, { createContext, useContext, useState, useCallback } from 'react';
import CustomAlert, { AlertOptions, AlertType } from '../components/common/CustomAlert';

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    title?: string,
    destructive?: boolean
  ) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<AlertOptions & { visible: boolean }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showAlert = useCallback((options: AlertOptions) => {
    setAlert({
      ...options,
      visible: true,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlert((prev) => ({ ...prev, visible: false }));
    if (alert.onDismiss) {
      alert.onDismiss();
    }
  }, [alert.onDismiss]);

  const showSuccess = useCallback(
    (message: string, title: string = 'Success') => {
      showAlert({ message, title, type: 'success' });
    },
    [showAlert]
  );

  const showError = useCallback(
    (message: string, title: string = 'Error') => {
      showAlert({ message, title, type: 'error' });
    },
    [showAlert]
  );

  const showInfo = useCallback(
    (message: string, title: string = 'Info') => {
      showAlert({ message, title, type: 'info' });
    },
    [showAlert]
  );

  const showWarning = useCallback(
    (message: string, title: string = 'Warning') => {
      showAlert({ message, title, type: 'warning' });
    },
    [showAlert]
  );

  const showConfirm = useCallback(
    (
      message: string,
      onConfirm: () => void,
      onCancel?: () => void,
      title: string = 'Confirm',
      destructive: boolean = false
    ) => {
      showAlert({
        message,
        title,
        type: 'confirm',
        buttons: [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: onCancel,
          },
          {
            text: 'Confirm',
            style: destructive ? 'destructive' : 'default',
            onPress: onConfirm,
          },
        ],
      });
    },
    [showAlert]
  );

  return (
    <AlertContext.Provider
      value={{
        showAlert,
        showSuccess,
        showError,
        showInfo,
        showWarning,
        showConfirm,
      }}
    >
      {children}
      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        buttons={alert.buttons}
        onDismiss={hideAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};

