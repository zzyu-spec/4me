import Foundation
import JavaScriptCore

struct WidgetItem: Codable, Identifiable {
    let id: String
    let title: String
    let detail: String
    let view: String
    let date: String
    var displayID: String { view + ":" + id }
    var url: URL {
        var parts = URLComponents()
        parts.scheme = "harugyeolwidgets"; parts.host = "open"
        parts.queryItems = [URLQueryItem(name: "view", value: view), URLQueryItem(name: "date", value: date), URLQueryItem(name: "id", value: id)]
        return parts.url!
    }
}
struct WidgetContent: Codable {
    let date: String
    let accent: String
    let events: [WidgetItem]
    let todos: [WidgetItem]
    let habits: [WidgetItem]
    let eventCount: Int
    let todoCount: Int
    let habitCount: Int
    let habitTotal: Int
    static func empty(date: Date = Date()) -> WidgetContent {
        WidgetContent(date: dateString(date), accent: "#789681", events: [], todos: [], habits: [], eventCount: 0, todoCount: 0, habitCount: 0, habitTotal: 0)
    }
    var primary: WidgetItem? { events.first ?? todos.first ?? habits.first }
}
struct SavedWidget: Codable {
    let owner: String
    let session: String
    let updatedAt: Date
    let content: WidgetContent
}
struct WidgetResult {
    let content: WidgetContent
    let message: String?
    let updatedAt: Date?
    static let signedOut = WidgetResult(content: .empty(), message: "위젯 앱에서 로그인해 주세요", updatedAt: nil)
}
func dateString(_ date: Date) -> String {
    let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.calendar = Calendar(identifier: .gregorian); f.timeZone = .current; f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}
func clockString(_ date: Date) -> String {
    let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = .current; f.dateFormat = "HH:mm"
    return f.string(from: date)
}
enum WidgetFailure: Error, LocalizedError {
    case message(String), signedOut, changedSession
    var errorDescription: String? {
        switch self {
        case .message(let text): return text
        case .signedOut: return "로그인이 만료됐어요. 위젯 앱에서 다시 로그인해 주세요."
        case .changedSession: return "계정이 변경돼 갱신을 중단했어요."
        }
    }
}
func decodeFirestore(_ value: [String: Any]) throws -> Any {
    if let map = value["mapValue"] as? [String: Any] {
        let fields = map["fields"] as? [String: [String: Any]] ?? [:]
        return try fields.mapValues(decodeFirestore)
    }
    if let array = value["arrayValue"] as? [String: Any] {
        return try (array["values"] as? [[String: Any]] ?? []).map(decodeFirestore)
    }
    if let text = value["stringValue"] as? String { return text }
    if let text = value["timestampValue"] as? String { return text }
    if let number = value["integerValue"] as? String, let n = Int64(number) { return NSNumber(value: n) }
    if let number = value["doubleValue"] as? Double, number.isFinite { return NSNumber(value: number) }
    if let flag = value["booleanValue"] as? Bool { return flag }
    if value["nullValue"] != nil { return NSNull() }
    throw WidgetFailure.message("서버 기록 형식을 확인하지 못했어요.")
}
func decodeCloudKeys(_ value: Any, enabled: Bool = true) throws -> Any {
    if let array = value as? [Any] { return try array.map { try decodeCloudKeys($0, enabled: enabled) } }
    guard let map = value as? [String: Any] else { return value }
    var result: [String: Any] = [:]
    for (key, item) in map {
        if key == "~harugyeol-key~version" { continue }
        var decoded = key
        if enabled && key.hasPrefix("~harugyeol-key~") {
            let hex = String(key.dropFirst("~harugyeol-key~".count))
            guard hex.count % 2 == 0 else { throw WidgetFailure.message("필드명 형식을 확인하지 못했어요.") }
            var bytes: [UInt8] = []; var index = hex.startIndex
            while index < hex.endIndex {
                let end = hex.index(index, offsetBy: 2)
                guard let byte = UInt8(hex[index..<end], radix: 16) else { throw WidgetFailure.message("필드명 형식 오류") }
                bytes.append(byte); index = end
            }
            guard let name = String(bytes: bytes, encoding: .utf8), result[name] == nil else { throw WidgetFailure.message("필드명 형식 오류") }
            decoded = name
        }
        guard result[decoded] == nil else { throw WidgetFailure.message("중복 필드명 오류") }
        result[decoded] = try decodeCloudKeys(item, enabled: enabled)
    }
    return result
}
func projectWidget(_ snapshot: [String: Any], at date: Date = Date()) throws -> WidgetContent {
    guard let context = JSContext() else { throw WidgetFailure.message("위젯 표시를 준비하지 못했어요.") }
    var failed = false
    context.exceptionHandler = { _, _ in failed = true }
    for name in ["reminder-model", "WidgetProjection"] {
        guard let url = Bundle.main.url(forResource: name, withExtension: "js") else { throw WidgetFailure.message("위젯 리소스가 누락됐어요.") }
        context.evaluateScript(try String(contentsOf: url, encoding: .utf8))
    }
    guard !failed, let value = context.objectForKeyedSubscript("buildWidgetData")?.call(withArguments: [snapshot, dateString(date), clockString(date)]), !failed, let object = value.toDictionary() else { throw WidgetFailure.message("오늘 기록을 계산하지 못했어요.") }
    return try JSONDecoder().decode(WidgetContent.self, from: JSONSerialization.data(withJSONObject: object))
}
