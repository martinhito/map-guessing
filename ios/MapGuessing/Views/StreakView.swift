import SwiftUI

struct StreakView: View {
    let current: Int
    let max: Int

    var body: some View {
        HStack(spacing: 12) {
            StatPill(label: "Streak", value: "\(current)", systemImage: "flame.fill", color: .orange)
            StatPill(label: "Best", value: "\(max)", systemImage: "trophy.fill", color: .yellow)
        }
    }
}

private struct StatPill: View {
    let label: String
    let value: String
    let systemImage: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: systemImage)
                .foregroundStyle(color)
                .font(.caption)
            Text(value)
                .fontWeight(.semibold)
                .font(.callout.monospacedDigit())
        }
    }
}
