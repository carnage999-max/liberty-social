import AuthenticationServices
import ExpoModulesCore
import UIKit

private enum PendingPasskeyOperation {
  case registration
  case authentication
}

public final class ExpoPasskeysModule: Module, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
  private var pendingPromise: Promise?
  private var pendingOperation: PendingPasskeyOperation?

  public func definition() -> ModuleDefinition {
    Name("ExpoPasskeys")

    Function("isSupported") {
      if #available(iOS 15.0, *) {
        return true
      }
      return false
    }

    AsyncFunction("create") { (options: [String: Any], promise: Promise) in
      guard #available(iOS 15.0, *) else {
        return promise.reject("UNSUPPORTED", "Passkeys require iOS 15 or later")
      }
      do {
        let request = try self.makeRegistrationRequest(from: options)
        self.start(requests: [request], operation: .registration, promise: promise)
      } catch {
        promise.reject("INVALID_OPTIONS", error.localizedDescription)
      }
    }
    .runOnQueue(.main)

    AsyncFunction("get") { (options: [String: Any], promise: Promise) in
      guard #available(iOS 15.0, *) else {
        return promise.reject("UNSUPPORTED", "Passkeys require iOS 15 or later")
      }
      do {
        let request = try self.makeAuthenticationRequest(from: options)
        self.start(requests: [request], operation: .authentication, promise: promise)
      } catch {
        promise.reject("INVALID_OPTIONS", error.localizedDescription)
      }
    }
    .runOnQueue(.main)
  }

  @available(iOS 15.0, *)
  private func makeRegistrationRequest(from options: [String: Any]) throws -> ASAuthorizationPlatformPublicKeyCredentialRegistrationRequest {
    let publicKey = try dictionary(from: options["publicKey"], field: "publicKey")
    let rp = try dictionary(from: publicKey["rp"], field: "rp")
    let user = try dictionary(from: publicKey["user"], field: "user")

    let rpId = try string(from: rp["id"], field: "rp.id").replacingOccurrences(of: "www.", with: "", options: .anchored)
    let challenge = try decodeBase64URL(string(from: publicKey["challenge"], field: "challenge"))
    let userId = try decodeBase64URL(string(from: user["id"], field: "user.id"))
    let userName = try string(from: user["name"], field: "user.name")
    let displayName = (user["displayName"] as? String) ?? userName

    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
    let request = provider.createCredentialRegistrationRequest(
      challenge: challenge,
      name: userName,
      userID: userId
    )
    request.displayName = displayName
    request.userVerificationPreference = .preferred
    return request
  }

  @available(iOS 15.0, *)
  private func makeAuthenticationRequest(from options: [String: Any]) throws -> ASAuthorizationPlatformPublicKeyCredentialAssertionRequest {
    let publicKey = try dictionary(from: options["publicKey"], field: "publicKey")
    let rpId = try string(from: publicKey["rpId"], field: "rpId").replacingOccurrences(of: "www.", with: "", options: .anchored)
    let challenge = try decodeBase64URL(string(from: publicKey["challenge"], field: "challenge"))

    let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
    let request = provider.createCredentialAssertionRequest(challenge: challenge)
    request.userVerificationPreference = .preferred
    return request
  }

  @available(iOS 15.0, *)
  private func start(requests: [ASAuthorizationRequest], operation: PendingPasskeyOperation, promise: Promise) {
    guard pendingPromise == nil else {
      return promise.reject("IN_PROGRESS", "Another passkey operation is already in progress")
    }

    pendingPromise = promise
    pendingOperation = operation

    let controller = ASAuthorizationController(authorizationRequests: requests)
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performRequests()
  }

  private func clearPendingState() {
    pendingPromise = nil
    pendingOperation = nil
  }

  private func resolveRegistration(_ credential: ASAuthorizationPlatformPublicKeyCredentialRegistration) {
    let credentialId = base64URLEncode(credential.credentialID)
    pendingPromise?.resolve([
      "id": credentialId,
      "rawId": credentialId,
      "type": "public-key",
      "response": [
        "clientDataJSON": base64URLEncode(credential.rawClientDataJSON),
        "attestationObject": base64URLEncode(credential.rawAttestationObject),
      ],
    ])
    clearPendingState()
  }

  private func resolveAssertion(_ credential: ASAuthorizationPlatformPublicKeyCredentialAssertion) {
    let credentialId = base64URLEncode(credential.credentialID)
    pendingPromise?.resolve([
      "id": credentialId,
      "rawId": credentialId,
      "type": "public-key",
      "response": [
        "clientDataJSON": base64URLEncode(credential.rawClientDataJSON),
        "authenticatorData": base64URLEncode(credential.rawAuthenticatorData),
        "signature": base64URLEncode(credential.signature),
        "userHandle": credential.userID.isEmpty ? nil : base64URLEncode(credential.userID),
      ],
    ])
    clearPendingState()
  }

  public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
    if #available(iOS 15.0, *) {
      switch authorization.credential {
      case let credential as ASAuthorizationPlatformPublicKeyCredentialRegistration:
        resolveRegistration(credential)
      case let credential as ASAuthorizationPlatformPublicKeyCredentialAssertion:
        resolveAssertion(credential)
      default:
        pendingPromise?.reject("UNSUPPORTED_CREDENTIAL", "Unsupported authorization credential returned by iOS")
        clearPendingState()
      }
      return
    }

    pendingPromise?.reject("UNSUPPORTED", "Passkeys require iOS 15 or later")
    clearPendingState()
  }

  public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
    let nsError = error as NSError
    let code = ASAuthorizationError.Code(rawValue: nsError.code)

    let message: String
    switch code {
    case .canceled:
      message = "User cancelled the operation"
    case .failed:
      message = "Passkey request failed"
    case .invalidResponse:
      message = "Invalid response from passkey provider"
    case .notHandled:
      message = "Passkey request was not handled"
    case .notInteractive:
      message = "Passkey request could not be shown"
    default:
      message = nsError.localizedDescription
    }

    pendingPromise?.reject(
      pendingOperation == .registration ? "CREATE_ERROR" : "GET_ERROR",
      message
    )
    clearPendingState()
  }

  public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    if let currentViewController = appContext?.utilities?.currentViewController(),
       let window = currentViewController.view.window {
      return window
    }

    if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
       let window = windowScene.windows.first(where: \.isKeyWindow) {
      return window
    }

    return ASPresentationAnchor()
  }

  private func dictionary(from value: Any?, field: String) throws -> [String: Any] {
    guard let dictionary = value as? [String: Any] else {
      throw NSError(domain: "ExpoPasskeys", code: 1, userInfo: [NSLocalizedDescriptionKey: "\(field) is required"])
    }
    return dictionary
  }

  private func string(from value: Any?, field: String) throws -> String {
    guard let string = value as? String, !string.isEmpty else {
      throw NSError(domain: "ExpoPasskeys", code: 1, userInfo: [NSLocalizedDescriptionKey: "\(field) is required"])
    }
    return string
  }

  private func decodeBase64URL(_ value: String) throws -> Data {
    var base64 = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    let remainder = base64.count % 4
    if remainder > 0 {
      base64 += String(repeating: "=", count: 4 - remainder)
    }
    guard let data = Data(base64Encoded: base64) else {
      throw NSError(domain: "ExpoPasskeys", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid base64url value"])
    }
    return data
  }

  private func base64URLEncode(_ data: Data) -> String {
    data.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }
}
