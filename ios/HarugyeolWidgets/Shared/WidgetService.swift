import Foundation

final class WidgetService {
    private let session: URLSession
    init() {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 12; config.timeoutIntervalForResource = 25
        config.urlCache = nil; config.httpCookieStorage = nil
        session = URLSession(configuration: config)
    }
    private func send(_ request: URLRequest) async throws -> [String: Any] {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw WidgetFailure.message("서버 응답을 확인하지 못했어요.") }
        guard data.count <= 1_500_000 else { throw WidgetFailure.message("서버 기록이 위젯 처리 한도를 초과했어요.") }
        let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard (200..<300).contains(http.statusCode) else {
            let code = ((object["error"] as? [String: Any])?["message"] as? String) ?? ""
            if ["INVALID_REFRESH_TOKEN", "TOKEN_EXPIRED", "USER_DISABLED", "USER_NOT_FOUND"].contains(code) || http.statusCode == 401 { throw WidgetFailure.signedOut }
            if http.statusCode == 403 { throw WidgetFailure.signedOut }
            if ["INVALID_LOGIN_CREDENTIALS", "EMAIL_NOT_FOUND", "INVALID_PASSWORD"].contains(code) { throw WidgetFailure.message("이메일과 비밀번호를 확인해 주세요.") }
            if http.statusCode == 429 { throw WidgetFailure.message("요청이 잠시 제한됐어요. 잠시 후 다시 시도해 주세요.") }
            throw WidgetFailure.message("서버 연결에 실패했어요. 네트워크와 계정 동기화를 확인해 주세요.")
        }
        return object
    }
    private func post(_ url: URL, json: [String: Any]) async throws -> [String: Any] {
        var request = URLRequest(url: url); request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: json)
        return try await send(request)
    }
    func login(email: String, password: String) async throws {
        let config = try WidgetSettings.firebase(), key = config["apiKey"]!
        let result = try await post(URL(string: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=\(key)")!, json: ["email": email.trimmingCharacters(in: .whitespacesAndNewlines), "password": password, "returnSecureToken": true])
        guard let token = result["idToken"] as? String, let refresh = result["refreshToken"] as? String, let uid = result["localId"] as? String else { throw WidgetFailure.message("로그인 응답을 확인하지 못했어요.") }
        let info = try await post(URL(string: "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=\(key)")!, json: ["idToken": token])
        guard let profile = (info["users"] as? [[String: Any]])?.first, profile["localId"] as? String == uid, profile["emailVerified"] as? Bool == true else { throw WidgetFailure.message("하루결에서 이메일 인증을 완료한 뒤 로그인해 주세요.") }
        try WidgetAccountStore.save(WidgetCredentials(uid: uid, session: UUID().uuidString, refreshToken: refresh))
    }
    private func idToken(_ owner: WidgetCredentials) async throws -> String {
        let config = try WidgetSettings.firebase(), key = config["apiKey"]!
        var request = URLRequest(url: URL(string: "https://securetoken.googleapis.com/v1/token?key=\(key)")!)
        request.httpMethod = "POST"; request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var body = URLComponents(); body.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token"), URLQueryItem(name: "refresh_token", value: owner.refreshToken)]
        request.httpBody = body.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B").data(using: .utf8)
        let result = try await send(request)
        guard let token = result["id_token"] as? String, result["user_id"] as? String == owner.uid else { throw WidgetFailure.signedOut }
        try WidgetAccountStore.check(owner)
        if let refresh = result["refresh_token"] as? String { try WidgetAccountStore.updateToken(refresh, owner: owner) }
        return token
    }
    func load() async -> WidgetResult {
        do {
            guard let owner = try WidgetAccountStore.read() else { return .signedOut }
            do {
                let token = try await idToken(owner), config = try WidgetSettings.firebase(), project = config["projectId"]!
                var allowed = CharacterSet.urlPathAllowed; allowed.remove(charactersIn: "/?#%")
                guard let uid = owner.uid.addingPercentEncoding(withAllowedCharacters: allowed), !uid.isEmpty else { throw WidgetFailure.signedOut }
                var components = URLComponents(string: "https://firestore.googleapis.com/v1/projects/\(project)/databases/(default)/documents/users/\(uid)/planner/current")!
                // Request only planner fields used by the widget; no diary, music or photos.
                components.queryItems = ["events", "todos", "routines", "routineLogs", "eventCategories", "todoCategoryCompletions", "sections", "todoSectionOrder", "todoOrder", "weekStart", "themeColor", "`~harugyeol-key~version`"].map { URLQueryItem(name: "mask.fieldPaths", value: "snapshot." + $0) }
                var request = URLRequest(url: components.url!); request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); request.cachePolicy = .reloadIgnoringLocalCacheData
                let document = try await send(request)
                guard let fields = document["fields"] as? [String: [String: Any]], let source = fields["snapshot"], let snapshot = try decodeFirestore(source) as? [String: Any] else { throw WidgetFailure.message("하루결에서 계정 동기화를 먼저 켜 주세요.") }
                let version = snapshot["~harugyeol-key~version"] as? Int
                if let version = version, version != 1 { throw WidgetFailure.message("위젯 앱을 업데이트해 주세요.") }
                guard let decoded = try decodeCloudKeys(snapshot, enabled: version == 1) as? [String: Any] else { throw WidgetFailure.message("기록 형식 오류") }
                let content = try projectWidget(decoded), now = Date()
                try WidgetAccountStore.saveDisplay(SavedWidget(owner: owner.uid, session: owner.session, updatedAt: now, content: content), owner: owner)
                return WidgetResult(content: content, message: nil, updatedAt: now)
            } catch WidgetFailure.signedOut {
                try? WidgetAccountStore.clearIfCurrent(owner)
                return .signedOut
            } catch WidgetFailure.changedSession {
                return .signedOut
            } catch {
                try WidgetAccountStore.check(owner)
                if let saved = try WidgetAccountStore.cachedDisplay(owner) {
                    return WidgetResult(content: saved.content, message: "최근 저장된 기록 · 연결 대기", updatedAt: saved.updatedAt)
                }
                return WidgetResult(content: .empty(), message: (error as? LocalizedError)?.errorDescription ?? "기록을 불러오지 못했어요.", updatedAt: nil)
            }
        } catch {
            return WidgetResult(content: .empty(), message: (error as? LocalizedError)?.errorDescription ?? "기기 설정을 확인해 주세요.", updatedAt: nil)
        }
    }
}
