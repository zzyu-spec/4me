import SwiftUI
import UIKit
import WidgetKit

struct PlannerEntry: TimelineEntry {
    let date: Date
    let result: WidgetResult
}
struct PlannerProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlannerEntry {
        PlannerEntry(date: Date(), result: WidgetResult(content: .empty(), message: "하루결 위젯", updatedAt: nil))
    }
    func getSnapshot(in context: Context, completion: @escaping (PlannerEntry) -> Void) {
        if context.isPreview { completion(placeholder(in: context)); return }
        Task { completion(PlannerEntry(date: Date(), result: await WidgetService().load())) }
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PlannerEntry>) -> Void) {
        Task {
            let result = await WidgetService().load(), now = Date()
            var entries = [PlannerEntry(date: now, result: result)]
            // Never label yesterday's counts as today's when the OS delays refreshing.
            if let midnight = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now)) {
                entries.append(PlannerEntry(date: midnight, result: WidgetResult(content: .empty(date: midnight), message: "오늘 기록 갱신 대기", updatedAt: nil)))
            }
            completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(15 * 60))))
        }
    }
}
struct PlannerWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PlannerEntry
    private var content: WidgetContent { entry.result.content }
    private var accent: Color {
        let hex = content.accent.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let number = UInt32(hex, radix: 16) ?? 0x789681
        return Color(red: Double((number >> 16) & 255) / 255, green: Double((number >> 8) & 255) / 255, blue: Double(number & 255) / 255)
    }
    private var destination: URL { content.primary?.url ?? URL(string: "harugyeolwidgets://open?view=home")! }
    var body: some View {
        Group {
            switch family {
            case .accessoryInline:
                Text(entry.result.message ?? "하루결 · 남은 투두 \(content.todoCount)개")
            case .accessoryCircular:
                VStack(spacing: 2) {
                    Image(systemName: "checkmark.circle")
                    Text(entry.result.updatedAt == nil ? "—" : "\(content.todoCount)").font(.headline)
                }.accessibilityLabel("하루결 남은 투두 \(content.todoCount)개")
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 2) {
                    Text("하루결").font(.headline)
                    Text(entry.result.message ?? content.primary?.title ?? "오늘 예정된 항목이 없어요").lineLimit(1)
                    if entry.result.updatedAt != nil { Text("투두 \(content.todoCount) · 습관 \(content.habitCount)").font(.caption) }
                }
            default:
                dashboard.padding(4)
            }
        }.widgetURL(destination).privacySensitive().widgetSurface()
    }
    private var dashboard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("하루결", systemImage: "leaf.fill").font(.headline).foregroundStyle(accent)
                Spacer(minLength: 2)
                Text(entry.date, format: .dateTime.month().day()).font(.caption).foregroundStyle(.secondary)
            }
            if entry.result.updatedAt != nil {
                Text("일정 \(content.eventCount) · 투두 \(content.todoCount) · 습관 \(content.habitCount)").font(.caption).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.75)
                ForEach(Array((content.events + content.todos + content.habits).prefix(family == .systemLarge ? 7 : family == .systemSmall ? 2 : 3)), id: \.displayID) { item in
                    Link(destination: item.url) {
                        HStack(alignment: .top, spacing: 6) {
                            Image(systemName: item.view == "calendar" ? "calendar" : item.view == "todos" ? "square" : "leaf").font(.caption).foregroundStyle(accent)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(item.title).font(.subheadline).lineLimit(1)
                                if !item.detail.isEmpty { Text(item.detail).font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
                            }
                            Spacer(minLength: 0)
                        }
                    }
                }
                if content.primary == nil { Text("오늘 예정된 항목이 없어요").font(.subheadline).foregroundStyle(.secondary) }
            }
            if let message = entry.result.message { Text(message).font(.caption2).foregroundStyle(.secondary).lineLimit(2) }
            Spacer(minLength: 0)
            if let updated = entry.result.updatedAt { Text("확인 \(updated.formatted(date: .omitted, time: .shortened))").font(.caption2).foregroundStyle(.secondary) }
        }
    }
}
private extension View {
    @ViewBuilder func widgetSurface() -> some View {
        if #available(iOSApplicationExtension 17.0, *) { self.containerBackground(for: .widget) { Color(uiColor: .systemBackground) } }
        else { self.background(Color(uiColor: .systemBackground)) }
    }
}
@main struct HarugyeolWidget: Widget {
    let kind = "HarugyeolToday"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PlannerProvider()) { entry in PlannerWidgetView(entry: entry) }
            .configurationDisplayName("하루결")
            .description("오늘 일정과 남은 투두·습관을 확인해요.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryInline, .accessoryCircular, .accessoryRectangular])
    }
}
