import Foundation
import Security
import Darwin

struct WidgetCredentials: Codable {
    let uid: String
    let session: String
    var refreshToken: String
}
enum WidgetSettings {
    static func string(_ key: String) throws -> String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String, !value.isEmpty, !value.contains("$(") else { throw WidgetFailure.message("Xcode의 서명과 App Group 설정을 확인해 주세요.") }
        return value
    }
    static func firebase() throws -> [String: String] {
        guard let url = Bundle.main.url(forResource: "FirebaseConfig", withExtension: "plist"), let data = try? Data(contentsOf: url), let config = try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: String], config["projectId"] == "harugyeol-e7866", config["apiKey"]?.hasPrefix("AIza") == true else { throw WidgetFailure.message("Firebase 공개 설정을 확인해 주세요.") }
        return config
    }
}
enum WidgetAccountStore {
    static func query() throws -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "HarugyeolWidgetSession", kSecAttrAccount as String: "current", kSecAttrAccessGroup as String: try WidgetSettings.string("SharedKeychainGroup")]
    }
    private static func locked<T>(_ operation: () throws -> T) throws -> T {
        let path = try WidgetCache.url().deletingLastPathComponent().appendingPathComponent("session.lock").path
        let descriptor = open(path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw WidgetFailure.message("공유 저장소를 열지 못했어요.") }
        defer { close(descriptor) }
        guard flock(descriptor, LOCK_EX) == 0 else { throw WidgetFailure.message("기기 저장소를 잠그지 못했어요.") }
        defer { flock(descriptor, LOCK_UN) }
        return try operation()
    }
    static func read() throws -> WidgetCredentials? { try locked { try readUnlocked() } }
    private static func readUnlocked() throws -> WidgetCredentials? {
        var q = try query(); q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?; let status = SecItemCopyMatching(q as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw WidgetFailure.message("기기 보안 저장소를 열지 못했어요. 서명 또는 잠금 상태를 확인해 주세요.") }
        return try JSONDecoder().decode(WidgetCredentials.self, from: data)
    }
    static func save(_ value: WidgetCredentials) throws { try locked { try saveUnlocked(value); try WidgetCache.clear() } }
    private static func saveUnlocked(_ value: WidgetCredentials) throws {
        let data = try JSONEncoder().encode(value), q = try query()
        let changes = [kSecValueData as String: data]
        var status = SecItemUpdate(q as CFDictionary, changes as CFDictionary)
        if status == errSecItemNotFound {
            var create = q; create[kSecValueData as String] = data
            create[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            status = SecItemAdd(create as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw WidgetFailure.message("로그인을 보안 저장소에 저장하지 못했어요. Keychain Sharing 서명을 확인해 주세요.") }
    }
    static func clear() throws { try locked { try clearUnlocked() } }
    private static func clearUnlocked() throws {
        let status = SecItemDelete(try query() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw WidgetFailure.message("기기 로그인을 해제하지 못했어요.") }
        try WidgetCache.clear()
    }
    static func updateToken(_ token: String, owner: WidgetCredentials) throws {
        try locked {
            guard let current = try readUnlocked(), current.uid == owner.uid, current.session == owner.session else { throw WidgetFailure.changedSession }
            try saveUnlocked(WidgetCredentials(uid: current.uid, session: current.session, refreshToken: token))
        }
    }
    static func saveDisplay(_ display: SavedWidget, owner: WidgetCredentials) throws {
        try locked {
            guard let current = try readUnlocked(), current.uid == owner.uid, current.session == owner.session else { throw WidgetFailure.changedSession }
            try WidgetCache.save(display)
        }
    }
    static func clearIfCurrent(_ owner: WidgetCredentials) throws {
        try locked {
            guard let current = try readUnlocked(), current.uid == owner.uid, current.session == owner.session else { return }
            try clearUnlocked()
        }
    }

    static func cachedDisplay(_ owner: WidgetCredentials) throws -> SavedWidget? {
        try locked {
            guard let current = try readUnlocked(), current.uid == owner.uid, current.session == owner.session else { throw WidgetFailure.changedSession }
            return try WidgetCache.read(owner: owner)
        }
    }

    static func check(_ value: WidgetCredentials) throws {
        guard let current = try read(), current.uid == value.uid, current.session == value.session else { throw WidgetFailure.changedSession }
    }
}
enum WidgetCache {
    static func url() throws -> URL {
        guard let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: try WidgetSettings.string("SharedAppGroup")) else { throw WidgetFailure.message("App Groups 서명을 확인해 주세요.") }
        return group.appendingPathComponent("widget-display-v1.json")
    }
    static func read(owner: WidgetCredentials) throws -> SavedWidget? {
        guard let data = try? Data(contentsOf: url()), let saved = try? JSONDecoder().decode(SavedWidget.self, from: data), saved.owner == owner.uid, saved.session == owner.session, saved.content.date == dateString(Date()), Date().timeIntervalSince(saved.updatedAt) >= 0, Date().timeIntervalSince(saved.updatedAt) < 21600 else { return nil }
        return saved
    }
    static func save(_ value: SavedWidget) throws {
        let data = try JSONEncoder().encode(value)
        try data.write(to: url(), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    static func clear() throws {
        let file = try url()
        if FileManager.default.fileExists(atPath: file.path) { try FileManager.default.removeItem(at: file) }
    }
}
