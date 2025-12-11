package com.libertysocial.expo.passkeys

import android.app.Activity
import android.content.Context
import android.util.Base64
import androidx.credentials.*
import androidx.credentials.exceptions.*
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.fido.Fido
import com.google.android.gms.fido.fido2.Fido2ApiClient
import com.google.android.gms.fido.fido2.api.common.*
import com.google.gson.Gson
import com.google.gson.JsonObject
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
      try {
        val context = appContext.reactContext ?: return@Function false
        val fido2ApiClient = Fido.getFido2ApiClient(context)
        return@Function fido2ApiClient != null
      } catch (e: Exception) {
        return@Function false
      }
    }

    // Create a passkey (registration)
    AsyncFunction("create") { options: Map<String, Any>, promise: Promise ->
      scope.launch {
        try {
          val context = appContext.reactContext ?: run {
            promise.reject("CONTEXT_ERROR", "React context not available", null)
            return@launch
          }

          val activity = appContext.currentActivity ?: run {
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

          val rpId = rp["id"] as? String ?: run {
            promise.reject("INVALID_OPTIONS", "rp.id is required", null)
            return@launch
          }

          val rpName = rp["name"] as? String ?: ""

          // Decode base64url challenge
          val challengeBytes = base64UrlDecode(challenge)
          val userIdBytes = base64UrlDecode(userId)

          // Build PublicKeyCredentialCreationOptions
          val pubKeyCredParams = (publicKey["pubKeyCredParams"] as? List<*>)?.mapNotNull { param ->
            val paramMap = param as? Map<*, *> ?: return@mapNotNull null
            val alg = (paramMap["alg"] as? Number)?.toInt() ?: return@mapNotNull null
            PublicKeyCredentialParameters(PublicKeyCredentialType.PUBLIC_KEY.toString(), alg)
          } ?: listOf(PublicKeyCredentialParameters(PublicKeyCredentialType.PUBLIC_KEY.toString(), -7))

          val authenticatorSelection = AuthenticatorSelection.Builder()
            .setAuthenticatorAttachment(if ((publicKey["authenticatorSelection"] as? Map<*, *>)?.get("authenticatorAttachment") == "platform") {
              AuthenticatorAttachment.PLATFORM
            } else {
              AuthenticatorAttachment.CROSS_PLATFORM
            })
            .setRequireResidentKey(RequireResidentKey.RESIDENT_KEY_REQUIRED)
            .setUserVerificationRequirement(UserVerificationRequirement.REQUIRED)
            .build()

          val excludeCredentials = (publicKey["excludeCredentials"] as? List<*>)?.mapNotNull { cred ->
            val credMap = cred as? Map<*, *> ?: return@mapNotNull null
            val credId = credMap["id"] as? String ?: return@mapNotNull null
            PublicKeyCredentialDescriptor(
              PublicKeyCredentialType.PUBLIC_KEY.toString(),
              base64UrlDecode(credId),
              null
            )
          }

          val rpEntity = PublicKeyCredentialRpEntity(rpId, rpName, null)
          val userEntity = PublicKeyCredentialUserEntity(
            userIdBytes,
            userName,
            userDisplayName,
            null
          )

          val requestOptions = PublicKeyCredentialCreationOptions.Builder()
            .setRp(rpEntity)
            .setUser(userEntity)
            .setChallenge(challengeBytes)
            .setParameters(pubKeyCredParams)
            .setTimeoutSeconds(300.0)
            .setAuthenticatorSelection(authenticatorSelection)
            .apply {
              excludeCredentials?.let { setExcludeList(it) }
            }
            .build()

          // Use Credential Manager API
          val credentialManager = CredentialManager.create(context)
          val createPublicKeyCredentialRequest = CreatePublicKeyCredentialRequest(
            gson.toJson(requestOptions)
          )

          val result = credentialManager.createCredential(
            activity,
            createPublicKeyCredentialRequest
          )

          when (val credential = result.data) {
            is CreatePublicKeyCredentialResponse -> {
              val responseJson = credential.registrationResponseJson
              val responseObj = gson.fromJson(responseJson, JsonObject::class.java)

              val credentialId = responseObj.getAsJsonPrimitive("id").asString
              val rawId = responseObj.getAsJsonPrimitive("rawId")?.asString ?: credentialId
              val response = responseObj.getAsJsonObject("response")
              val clientDataJSON = response.getAsJsonPrimitive("clientDataJSON").asString
              val attestationObject = response.getAsJsonPrimitive("attestationObject").asString

              promise.resolve(mapOf(
                "id" to credentialId,
                "rawId" to rawId,
                "type" to "public-key",
                "response" to mapOf(
                  "clientDataJSON" to clientDataJSON,
                  "attestationObject" to attestationObject
                )
              ))
            }
            else -> {
              promise.reject("UNKNOWN_RESPONSE", "Unknown credential response type", null)
            }
          }
        } catch (e: CreateCredentialException) {
          when (e) {
            is CreatePublicKeyCredentialDomException -> {
              promise.reject("DOM_EXCEPTION", e.domError, e)
            }
            is CreateCredentialCancellationException -> {
              promise.reject("USER_CANCELLED", "User cancelled the operation", e)
            }
            is CreateCredentialInterruptedException -> {
              promise.reject("INTERRUPTED", "Operation was interrupted", e)
            }
            is CreateCredentialProviderConfigurationException -> {
              promise.reject("CONFIG_ERROR", "Provider configuration error", e)
            }
            is CreateCredentialUnknownException -> {
              promise.reject("UNKNOWN_ERROR", "Unknown error: ${e.errorMessage}", e)
            }
            else -> {
              promise.reject("CREATE_ERROR", "Failed to create credential: ${e.message}", e)
            }
          }
        } catch (e: Exception) {
          promise.reject("ERROR", "Unexpected error: ${e.message}", e)
        }
      }
    }

    // Get a passkey (authentication)
    AsyncFunction("get") { options: Map<String, Any>, promise: Promise ->
      scope.launch {
        try {
          val context = appContext.reactContext ?: run {
            promise.reject("CONTEXT_ERROR", "React context not available", null)
            return@launch
          }

          val activity = appContext.currentActivity ?: run {
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

          val allowCredentials = (publicKey["allowCredentials"] as? List<*>)?.mapNotNull { cred ->
            val credMap = cred as? Map<*, *> ?: return@mapNotNull null
            val credId = credMap["id"] as? String ?: return@mapNotNull null
            PublicKeyCredentialDescriptor(
              PublicKeyCredentialType.PUBLIC_KEY.toString(),
              base64UrlDecode(credId),
              null
            )
          }

          // Decode base64url challenge
          val challengeBytes = base64UrlDecode(challenge)

          // Build PublicKeyCredentialRequestOptions
          val requestOptions = PublicKeyCredentialRequestOptions.Builder()
            .setRpId(rpId)
            .setChallenge(challengeBytes)
            .setTimeoutSeconds(300.0)
            .apply {
              allowCredentials?.let { setAllowList(it) }
            }
            .build()

          // Use Credential Manager API
          val credentialManager = CredentialManager.create(context)
          val getPublicKeyCredentialRequest = GetPublicKeyCredentialRequest(
            gson.toJson(requestOptions)
          )

          val result = credentialManager.getCredential(
            activity,
            getPublicKeyCredentialRequest
          )

          when (val credential = result.data) {
            is GetPublicKeyCredentialResponse -> {
              val responseJson = credential.authenticationResponseJson
              val responseObj = gson.fromJson(responseJson, JsonObject::class.java)

              val credentialId = responseObj.getAsJsonPrimitive("id").asString
              val rawId = responseObj.getAsJsonPrimitive("rawId")?.asString ?: credentialId
              val response = responseObj.getAsJsonObject("response")
              val clientDataJSON = response.getAsJsonPrimitive("clientDataJSON").asString
              val authenticatorData = response.getAsJsonPrimitive("authenticatorData").asString
              val signature = response.getAsJsonPrimitive("signature").asString
              val userHandle = response.getAsJsonPrimitive("userHandle")?.asString

              promise.resolve(mapOf(
                "id" to credentialId,
                "rawId" to rawId,
                "type" to "public-key",
                "response" to mapOf(
                  "clientDataJSON" to clientDataJSON,
                  "authenticatorData" to authenticatorData,
                  "signature" to signature,
                  "userHandle" to userHandle
                )
              ))
            }
            else -> {
              promise.reject("UNKNOWN_RESPONSE", "Unknown credential response type", null)
            }
          }
        } catch (e: GetCredentialException) {
          when (e) {
            is GetPublicKeyCredentialDomException -> {
              promise.reject("DOM_EXCEPTION", e.domError, e)
            }
            is GetCredentialCancellationException -> {
              promise.reject("USER_CANCELLED", "User cancelled the operation", e)
            }
            is GetCredentialInterruptedException -> {
              promise.reject("INTERRUPTED", "Operation was interrupted", e)
            }
            is GetCredentialProviderConfigurationException -> {
              promise.reject("CONFIG_ERROR", "Provider configuration error", e)
            }
            is GetCredentialUnknownException -> {
              promise.reject("UNKNOWN_ERROR", "Unknown error: ${e.errorMessage}", e)
            }
            else -> {
              promise.reject("GET_ERROR", "Failed to get credential: ${e.message}", e)
            }
          }
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

