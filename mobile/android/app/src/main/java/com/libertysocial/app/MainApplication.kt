package com.libertysocial.app

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    
    // Initialize Firebase if not already initialized
    // This is required for Expo push notifications on Android
    // The google-services plugin should auto-initialize Firebase, but we ensure it's done
    try {
      val firebaseAppClass = Class.forName("com.google.firebase.FirebaseApp")
      
      // Check if Firebase is already initialized by trying to get the default instance
      var isInitialized = false
      try {
        val getInstanceMethod = firebaseAppClass.getMethod("getInstance")
        val defaultApp = getInstanceMethod.invoke(null)
        isInitialized = defaultApp != null
        if (isInitialized) {
          android.util.Log.i("MainApplication", "FirebaseApp already initialized (default instance exists)")
        }
      } catch (e: Exception) {
        // getInstance() throws if not initialized, which is what we want to check
        android.util.Log.d("MainApplication", "FirebaseApp not initialized yet (getInstance failed as expected)")
      }
      
      if (!isInitialized) {
        android.util.Log.i("MainApplication", "Initializing FirebaseApp...")
        
        // Try to get FirebaseOptions from resources (set by google-services plugin)
        // FirebaseOptions.fromResource() reads from google-services.json
        try {
          val firebaseOptionsClass = Class.forName("com.google.firebase.FirebaseOptions")
          val fromResourceMethod = firebaseOptionsClass.getMethod("fromResource", android.content.Context::class.java)
          val options = fromResourceMethod.invoke(null, this)
          
          if (options != null) {
            // Initialize with options from google-services.json
            val initializeAppMethod = firebaseAppClass.getMethod("initializeApp", android.content.Context::class.java, firebaseOptionsClass)
            initializeAppMethod.invoke(null, this, options)
            android.util.Log.i("MainApplication", "FirebaseApp initialized successfully with options from google-services.json")
            
            // Verify initialization
            val getInstanceMethod = firebaseAppClass.getMethod("getInstance")
            val defaultApp = getInstanceMethod.invoke(null)
            if (defaultApp != null) {
              android.util.Log.i("MainApplication", "FirebaseApp initialization verified - default instance exists")
            } else {
              android.util.Log.w("MainApplication", "FirebaseApp initialization may have failed - no default instance")
            }
          } else {
            android.util.Log.e("MainApplication", "Failed to load FirebaseOptions from resources (returned null)")
            android.util.Log.e("MainApplication", "This usually means google-services.json is missing or invalid")
          }
        } catch (e: ClassNotFoundException) {
          android.util.Log.e("MainApplication", "FirebaseOptions class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
          android.util.Log.e("MainApplication", "FirebaseOptions method not found: ${e.message}")
          android.util.Log.e("MainApplication", "Trying fallback initialization...")
          
          // Fallback: try initializeApp(Context) - this should use default options
          try {
            val initializeAppMethod = firebaseAppClass.getMethod("initializeApp", android.content.Context::class.java)
            initializeAppMethod.invoke(null, this)
            android.util.Log.i("MainApplication", "FirebaseApp initialized with fallback method")
          } catch (initError: Exception) {
            android.util.Log.e("MainApplication", "Fallback initialization also failed: ${initError.message}")
            android.util.Log.e("MainApplication", "Firebase may not be properly configured")
          }
        } catch (e: Exception) {
          android.util.Log.e("MainApplication", "Error initializing Firebase: ${e.message}")
          android.util.Log.e("MainApplication", "Exception: ${e.javaClass.name}")
          if (BuildConfig.DEBUG) {
            e.printStackTrace()
          }
        }
      }
    } catch (e: ClassNotFoundException) {
      android.util.Log.w("MainApplication", "FirebaseApp class not found. Firebase features will be unavailable.")
      android.util.Log.w("MainApplication", "This is expected if google-services.json is missing or Firebase dependencies are not included.")
    } catch (e: NoSuchMethodException) {
      android.util.Log.w("MainApplication", "FirebaseApp method not found: ${e.message}")
      android.util.Log.w("MainApplication", "Firebase features will be unavailable.")
    } catch (e: Exception) {
      android.util.Log.e("MainApplication", "Firebase initialization failed: ${e.message}")
      android.util.Log.e("MainApplication", "Exception type: ${e.javaClass.name}")
      if (BuildConfig.DEBUG) {
        android.util.Log.e("MainApplication", "Stack trace: ${e.stackTraceToString()}")
      }
    }
    
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
