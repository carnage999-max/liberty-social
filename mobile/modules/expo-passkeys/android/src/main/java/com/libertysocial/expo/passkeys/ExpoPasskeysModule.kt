package com.libertysocial.expo.passkeys

import android.app.Activity
import android.content.Context
import android.util.Base64
import android.app.KeyguardManager
import android.os.Build
import androidx.credentials.*
import androidx.credentials.exceptions.*
import androidx.credentials.exceptions.publickeycredential.CreatePublicKeyCredentialDomException
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.GetCredentialRequest
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.fido.Fido
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonElement
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.*

class ExpoPasskeysModule : Module() {
  private val gson = Gson()
  private val scope = CoroutineScope(Dispatchers.Main)

  override fun definition() = ModuleDefinition {
    Name("ExpoPasskeys")

    // Check if passkeys are supported
    Function("isSupported") {
      // On Android 9+ (API 28+), Credential Manager is available
      // Since the user is on Android 15, passkeys are definitely supported
      // Just return true - the actual checks will happen when creating/getting credentials
      return@Function Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
    }

    // Create a passkey (registration)
    AsyncFunction("create") { options: Map<String, Any>, promise: Promise ->
      scope.launch {
        // Declare rpId outside try block so it's accessible in catch block
        var rpId: String? = null
        try {
          val context = this@ExpoPasskeysModule.appContext.reactContext ?: run {
            promise.reject("CONTEXT_ERROR", "React context not available", null)
            return@launch
          }

          val activity = this@ExpoPasskeysModule.appContext.currentActivity ?: run {
            promise.reject("ACTIVITY_ERROR", "Activity not available", null)
            return@launch
          }

          // Parse options
          val publicKey = options["publicKey"] as? Map<*, *> ?: run {
            promise.reject("INVALID_OPTIONS", "publicKey is required", null)
            return@launch
          }

          val challenge = publicKey["challenge"] as? String ?: run {
            promise.reject("INVALID_OPTIONS", "challenge is required", null)
            return@launch
          }

          val rp = publicKey["rp"] as? Map<*, *> ?: run {
            promise.reject("INVALID_OPTIONS", "rp is required", null)
            return@launch
          }

          val user = publicKey["user"] as? Map<*, *> ?: run {
            promise.reject("INVALID_OPTIONS", "user is required", null)
            return@launch
          }

          val userDisplayName = user["displayName"] as? String ?: ""
          val userName = user["name"] as? String ?: run {
            promise.reject("INVALID_OPTIONS", "user.name is required", null)
            return@launch
          }

          val userId = user["id"] as? String ?: run {
            promise.reject("INVALID_OPTIONS", "user.id is required", null)
            return@launch
          }

          rpId = rp["id"] as? String ?: run {
            promise.reject("INVALID_OPTIONS", "rp.id is required", null)
            return@launch
          }

          // Remove www. prefix if present - Android Credential Manager requires domain without www
          rpId = rpId.removePrefix("www.")

          val rpName = rp["name"] as? String ?: ""

          // Validate base64url encoding for challenge and user.id
          // Credential Manager requires these to be valid base64url strings
          try {
            // Try to decode to validate they're valid base64url
            base64UrlDecode(challenge)
            base64UrlDecode(userId)
          } catch (e: Exception) {
            android.util.Log.e("ExpoPasskeys", "Invalid base64url encoding", e)
            promise.reject("INVALID_ENCODING", "challenge or user.id is not valid base64url: ${e.message}", null)
            return@launch
          }

          android.util.Log.d("ExpoPasskeys", "Creating credential with rpId: $rpId, userName: $userName")

          // Build JSON request directly for Credential Manager API
          // Credential Manager accepts WebAuthn JSON format
          val requestJson = JsonObject().apply {
            addProperty("challenge", challenge)
            add("rp", JsonObject().apply {
              addProperty("id", rpId)
              addProperty("name", rpName)
            })
            add("user", JsonObject().apply {
              addProperty("id", userId)
              addProperty("name", userName)
              addProperty("displayName", userDisplayName)
            })
            
            // PubKeyCredParams
            val pubKeyCredParams = (publicKey["pubKeyCredParams"] as? List<*>)?.mapNotNull { param ->
              val paramMap = param as? Map<*, *> ?: return@mapNotNull null
              val alg = (paramMap["alg"] as? Number)?.toInt() ?: return@mapNotNull null
              JsonObject().apply {
                addProperty("type", "public-key")
                addProperty("alg", alg)
              }
            } ?: listOf(JsonObject().apply {
              addProperty("type", "public-key")
              addProperty("alg", -7)
            })
            add("pubKeyCredParams", gson.toJsonTree(pubKeyCredParams))
            
            // AuthenticatorSelection
            val authenticatorSelectionObj = JsonObject()
            val authenticatorAttachment = (publicKey["authenticatorSelection"] as? Map<*, *>)?.get("authenticatorAttachment")
            if (authenticatorAttachment != null) {
              authenticatorSelectionObj.addProperty("authenticatorAttachment", authenticatorAttachment.toString())
            }
            authenticatorSelectionObj.addProperty("requireResidentKey", true)
            authenticatorSelectionObj.addProperty("userVerification", "required")
            add("authenticatorSelection", authenticatorSelectionObj)
            
            // ExcludeCredentials
            val excludeCredentials = (publicKey["excludeCredentials"] as? List<*>)?.mapNotNull { cred ->
              val credMap = cred as? Map<*, *> ?: return@mapNotNull null
              val credId = credMap["id"] as? String ?: return@mapNotNull null
              // Validate base64url encoding for credential IDs
              try {
                base64UrlDecode(credId)
              } catch (e: Exception) {
                android.util.Log.w("ExpoPasskeys", "Invalid base64url in excludeCredentials ID, skipping: $credId")
                return@mapNotNull null
              }
              JsonObject().apply {
                addProperty("type", "public-key")
                addProperty("id", credId)
              }
            }
            if (excludeCredentials != null && excludeCredentials.isNotEmpty()) {
              add("excludeCredentials", gson.toJsonTree(excludeCredentials))
            }
            
            addProperty("timeout", 300000)
          }

          // Use Credential Manager API
          val credentialManager = CredentialManager.create(context)
          val requestJsonString = gson.toJson(requestJson)
          android.util.Log.d("ExpoPasskeys", "Request JSON: $requestJsonString")
          
          val createPublicKeyCredentialRequest = CreatePublicKeyCredentialRequest(
            requestJsonString
          )

          android.util.Log.d("ExpoPasskeys", "Calling credentialManager.createCredential...")
          val result = credentialManager.createCredential(
            activity,
            createPublicKeyCredentialRequest
          )
          android.util.Log.d("ExpoPasskeys", "Credential created successfully")

          // CreateCredentialResponse doesn't have a credential property
          // Cast to CreatePublicKeyCredentialResponse to access credentialData
          val credentialResponse = result as? CreatePublicKeyCredentialResponse ?: run {
            promise.reject("PARSE_ERROR", "Failed to cast to CreatePublicKeyCredentialResponse", null)
            return@launch
          }
          
          // Get the registration response JSON from credentialData
          val responseJson = credentialResponse.registrationResponseJson
          
          val responseObj = gson.fromJson(responseJson, JsonObject::class.java)

          val credentialIdElement = responseObj.get("id")
          val credentialId = if (credentialIdElement != null && credentialIdElement.isJsonPrimitive) {
            credentialIdElement.asString
          } else {
            promise.reject("PARSE_ERROR", "Missing id in response", null)
            return@launch
          }
          
          val rawIdElement = responseObj.get("rawId")
          val rawId = if (rawIdElement != null && rawIdElement.isJsonPrimitive) {
            rawIdElement.asString
          } else {
            credentialId
          }
          
          val responseElement = responseObj.get("response")
          if (responseElement == null || !responseElement.isJsonObject) {
            promise.reject("PARSE_ERROR", "Missing response object", null)
            return@launch
          }
          val response = responseElement.asJsonObject
          
          val clientDataJSONElement = response.get("clientDataJSON")
          val clientDataJSON = if (clientDataJSONElement != null && clientDataJSONElement.isJsonPrimitive) {
            clientDataJSONElement.asString
          } else {
            promise.reject("PARSE_ERROR", "Missing clientDataJSON", null)
            return@launch
          }
          
          val attestationObjectElement = response.get("attestationObject")
          val attestationObject = if (attestationObjectElement != null && attestationObjectElement.isJsonPrimitive) {
            attestationObjectElement.asString
          } else {
            promise.reject("PARSE_ERROR", "Missing attestationObject", null)
            return@launch
          }

          promise.resolve(mapOf<String, Any>(
            "id" to credentialId,
            "rawId" to rawId,
            "type" to "public-key",
            "response" to mapOf<String, String>(
              "clientDataJSON" to clientDataJSON,
              "attestationObject" to attestationObject
            )
          ))
        } catch (e: CreateCredentialException) {
          android.util.Log.e("ExpoPasskeys", "CreateCredentialException", e)
          val errorMessage = when (e) {
            is CreateCredentialCancellationException -> "User cancelled the operation"
            is CreateCredentialInterruptedException -> "Operation was interrupted"
            is CreateCredentialProviderConfigurationException -> "Provider configuration error"
            is CreatePublicKeyCredentialDomException -> {
              val msg = e.message ?: "Domain validation failed"
              android.util.Log.e("ExpoPasskeys", "CreatePublicKeyCredentialDomException: $msg")
              val domain = rpId ?: "unknown"
              android.util.Log.e("ExpoPasskeys", "rp.id used: $domain")
              android.util.Log.e("ExpoPasskeys", "App package: com.libertysocial.app")
              android.util.Log.e("ExpoPasskeys", "This error means Digital Asset Links are not configured.")
              android.util.Log.e("ExpoPasskeys", "Required: https://$domain/.well-known/assetlinks.json must exist and link to com.libertysocial.app")
              "Domain validation failed. Digital Asset Links must be configured at https://$domain/.well-known/assetlinks.json linking to com.libertysocial.app"
            }
            is CreateCredentialUnknownException -> {
              val msg = e.errorMessage ?: e.message ?: "Unknown error"
              android.util.Log.e("ExpoPasskeys", "CreateCredentialUnknownException: $msg")
              "Failed to create credentials: $msg"
            }
            else -> {
              val msg = e.message ?: "Unknown error"
              android.util.Log.e("ExpoPasskeys", "CreateCredentialException: $msg")
              "Failed to create credential: $msg"
            }
          }
          promise.reject("CREATE_ERROR", errorMessage, e)
        } catch (e: Exception) {
          android.util.Log.e("ExpoPasskeys", "Unexpected error in create", e)
          promise.reject("ERROR", "Unexpected error: ${e.message}", e)
        }
      }
    }

    // Get a passkey (authentication)
    AsyncFunction("get") { options: Map<String, Any>, promise: Promise ->
      scope.launch {
        try {
          val context = this@ExpoPasskeysModule.appContext.reactContext ?: run {
            promise.reject("CONTEXT_ERROR", "React context not available", null)
            return@launch
          }

          val activity = this@ExpoPasskeysModule.appContext.currentActivity ?: run {
            promise.reject("ACTIVITY_ERROR", "Activity not available", null)
            return@launch
          }

          // Parse options
          val publicKey = options["publicKey"] as? Map<*, *> ?: run {
            promise.reject("INVALID_OPTIONS", "publicKey is required", null)
            return@launch
          }

          val challenge = publicKey["challenge"] as? String ?: run {
            promise.reject("INVALID_OPTIONS", "challenge is required", null)
            return@launch
          }

          val rpId = publicKey["rpId"] as? String ?: run {
            promise.reject("INVALID_OPTIONS", "rpId is required", null)
            return@launch
          }

          // Build JSON request directly for Credential Manager API
          val requestJson = JsonObject().apply {
            addProperty("challenge", challenge)
            addProperty("rpId", rpId)
            addProperty("timeout", 300000)
            
            // AllowCredentials
            val allowCredentials = (publicKey["allowCredentials"] as? List<*>)?.mapNotNull { cred ->
              val credMap = cred as? Map<*, *> ?: return@mapNotNull null
              val credId = credMap["id"] as? String ?: return@mapNotNull null
              JsonObject().apply {
                addProperty("type", "public-key")
                addProperty("id", credId)
              }
            }
            if (allowCredentials != null && allowCredentials.isNotEmpty()) {
              add("allowCredentials", gson.toJsonTree(allowCredentials))
            }
          }

          // Use Credential Manager API
          val credentialManager = CredentialManager.create(context)
          val getPublicKeyCredentialOption = GetPublicKeyCredentialOption(
            gson.toJson(requestJson)
          )
          val getCredentialRequest = GetCredentialRequest(
            listOf(getPublicKeyCredentialOption)
          )

          val result = credentialManager.getCredential(
            activity,
            getCredentialRequest
          )

          // GetCredentialResponse has a credential property
          // The credential should be a PublicKeyCredential with authenticationResponseJson
          val credential = result.credential
          
          // Extract authentication response JSON from the credential data bundle
          val credentialData = credential.data
          val responseJsonKey = "androidx.credentials.BUNDLE_KEY_AUTHENTICATION_RESPONSE_JSON"
          val responseJsonBytes: ByteArray? = credentialData.getByteArray(responseJsonKey)
          
          if (responseJsonBytes == null) {
            promise.reject("PARSE_ERROR", "Missing authentication response JSON in credential data", null)
            return@launch
          }
          
          val responseJson = String(responseJsonBytes, Charsets.UTF_8)
          val responseObj = gson.fromJson(responseJson, JsonObject::class.java)

          val credentialIdElement = responseObj.get("id")
          val credentialId = if (credentialIdElement != null && credentialIdElement.isJsonPrimitive) {
            credentialIdElement.asJsonPrimitive.asString
          } else {
            promise.reject("PARSE_ERROR", "Missing id in response", null)
            return@launch
          }
          
          val rawIdElement = responseObj.get("rawId")
          val rawId = if (rawIdElement != null && rawIdElement.isJsonPrimitive) {
            rawIdElement.asJsonPrimitive.asString
          } else {
            credentialId
          }
          
          val responseElement = responseObj.get("response")
          if (responseElement == null || !responseElement.isJsonObject) {
            promise.reject("PARSE_ERROR", "Missing response object", null)
            return@launch
          }
          val response = responseElement.asJsonObject
          
          val clientDataJSONElement = response.get("clientDataJSON")
          val clientDataJSON = if (clientDataJSONElement != null && clientDataJSONElement.isJsonPrimitive) {
            clientDataJSONElement.asJsonPrimitive.asString
          } else {
            promise.reject("PARSE_ERROR", "Missing clientDataJSON", null)
            return@launch
          }
          
          val authenticatorDataElement = response.get("authenticatorData")
          val authenticatorData = if (authenticatorDataElement != null && authenticatorDataElement.isJsonPrimitive) {
            authenticatorDataElement.asJsonPrimitive.asString
          } else {
            promise.reject("PARSE_ERROR", "Missing authenticatorData", null)
            return@launch
          }
          
          val signatureElement = response.get("signature")
          val signature = if (signatureElement != null && signatureElement.isJsonPrimitive) {
            signatureElement.asJsonPrimitive.asString
          } else {
            promise.reject("PARSE_ERROR", "Missing signature", null)
            return@launch
          }
          
          val userHandleElement = response.get("userHandle")
          val userHandle = if (userHandleElement != null && userHandleElement.isJsonPrimitive) {
            userHandleElement.asJsonPrimitive.asString
          } else {
            null
          }

          promise.resolve(mapOf<String, Any>(
            "id" to credentialId,
            "rawId" to rawId,
            "type" to "public-key",
            "response" to mapOf<String, String?>(
              "clientDataJSON" to clientDataJSON,
              "authenticatorData" to authenticatorData,
              "signature" to signature,
              "userHandle" to userHandle
            )
          ))
        } catch (e: GetCredentialException) {
          val errorMessage = when (e) {
            is GetCredentialCancellationException -> "User cancelled the operation"
            is GetCredentialInterruptedException -> "Operation was interrupted"
            is GetCredentialProviderConfigurationException -> "Provider configuration error"
            is GetCredentialUnknownException -> "Unknown error: ${e.errorMessage}"
            else -> "Failed to get credential: ${e.message}"
          }
          promise.reject("GET_ERROR", errorMessage, e)
        } catch (e: Exception) {
          promise.reject("ERROR", "Unexpected error: ${e.message}", e)
        }
      }
    }
  }

  private fun base64UrlDecode(input: String): ByteArray {
    // Convert base64url to base64
    var base64 = input.replace('-', '+').replace('_', '/')
    // Add padding if needed
    when (base64.length % 4) {
      2 -> base64 += "=="
      3 -> base64 += "="
    }
    return Base64.decode(base64, Base64.NO_WRAP)
  }
}

