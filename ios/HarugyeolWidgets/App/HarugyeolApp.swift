import SwiftUI
import UIKit
import WidgetKit

@MainActor final class WidgetAccount: ObservableObject {
    @Published var signedIn = false
    @Published var busy = false
    @Published var result = WidgetResult.signedOut
    @Published var error = ""
    func refresh() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do { signedIn = try WidgetAccountStore.read() != nil } catch { self.error = error.localizedDescription; return }
        result = await WidgetService().load()
        signedIn = (try? WidgetAccountStore.read()) != nil
        WidgetCenter.shared.reloadAllTimelines()
    }
    func login(_ email: String, _ password: String) async {
        guard !busy else { return }; busy = true; error = ""
        do { try await WidgetService().login(email: email, password: password); signedIn = true } catch { self.error = error.localizedDescription }
        busy = false
        if signedIn { await refresh() }
    }
    func logout() {
        do { try WidgetAccountStore.clear(); signedIn = false; result = .signedOut; WidgetCenter.shared.reloadAllTimelines() }
        catch { self.error = error.localizedDescription }
    }
}
@main struct HarugyeolWidgetApp: App {
    @StateObject private var account = WidgetAccount()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            WidgetSetupView().environmentObject(account)
                .task { await account.refresh() }
                .onChange(of: phase) { value in if value == .active { Task { await account.refresh() } } }
                .onOpenURL { url in
                    guard url.scheme == "harugyeolwidgets", url.host == "open", let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
                    let value = Dictionary(components.queryItems?.map { ($0.name, $0.value ?? "") } ?? [], uniquingKeysWith: { _, last in last })
                    let view = value["view"] ?? "home"
                    guard ["home", "calendar", "todos", "routines"].contains(view) else { return }
                    var target = URLComponents(string: "https://zzyu-spec.github.io/4me/index.html")!
                    target.queryItems = [URLQueryItem(name: "pushView", value: view), URLQueryItem(name: "pushDate", value: value["date"] ?? dateString(Date())), URLQueryItem(name: "pushId", value: value["id"] ?? "")]
                    if let destination = target.url { UIApplication.shared.open(destination) }
                }
        }
    }
}
struct WidgetSetupView: View {
    @EnvironmentObject var account: WidgetAccount
    @State private var email = ""
    @State private var password = ""
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("하루결 위젯").font(.title2.bold())
                    Text("하루결과 같은 계정의 일정·투두·습관을 아이폰 위젯에서 확인해요.").foregroundStyle(.secondary)
                }
                if !account.signedIn {
                    Section("하루결 계정") {
                        TextField("이메일", text: $email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                        SecureField("비밀번호", text: $password).textContentType(.password)
                        Button("로그인") { let secret = password; password = ""; Task { await account.login(email, secret) } }.disabled(account.busy || email.isEmpty || password.isEmpty)
                        Text("이메일 인증과 하루결 계정 동기화가 필요해요. 비밀번호는 저장하지 않아요.").font(.footnote).foregroundStyle(.secondary)
                    }
                } else {
                    Section("오늘") {
                        LabeledContent("일정", value: "\(account.result.content.eventCount)개")
                        LabeledContent("남은 투두", value: "\(account.result.content.todoCount)개")
                        LabeledContent("남은 습관", value: "\(account.result.content.habitCount)개")
                        if let message = account.result.message { Text(message).font(.footnote).foregroundStyle(.secondary) }
                        if let date = account.result.updatedAt { Text("마지막 확인 \(date.formatted(date: .omitted, time: .shortened))").font(.footnote).foregroundStyle(.secondary) }
                        Button("지금 갱신") { Task { await account.refresh() } }.disabled(account.busy)
                    }
                    Section("위젯 추가") {
                        Text("홈 화면을 길게 누른 뒤 위젯 추가에서 ‘하루결’을 찾아 선택해 주세요.")
                        Text("잠금 화면은 길게 누르기 → 사용자화 → 잠금 화면 → 위젯 추가에서 ‘하루결’을 선택해요.")
                        Text("갱신 주기는 iOS가 조절하므로 즉시 반영되지 않을 수 있어요.").font(.footnote).foregroundStyle(.secondary)
                    }
                    Section { Button("위젯 계정 연결 해제", role: .destructive) { account.logout() } }
                }
                if account.busy { ProgressView("확인 중…") }
                if !account.error.isEmpty { Text(account.error).foregroundStyle(.red) }
                Section { Link("하루결 열기", destination: URL(string: "https://zzyu-spec.github.io/4me/")!) }
            }.navigationTitle("하루결")
        }.tint(Color(red: 0.47, green: 0.59, blue: 0.51))
    }
}
