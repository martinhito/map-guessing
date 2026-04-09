import SwiftUI

struct HelpSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("How to Play") {
                    HelpRow(icon: "map.fill", color: .blue, title: "Study the Map", description: "A mystery map is shown. Zoom in with pinch gestures to explore details.")
                    HelpRow(icon: "text.cursor", color: .green, title: "Type Your Guess", description: "Enter what you think the map represents — a place, concept, or phenomenon.")
                    HelpRow(icon: "arrow.up.circle.fill", color: .blue, title: "Submit", description: "Hit submit (or press Return) to see how close you are.")
                }

                Section("Similarity Colors") {
                    ColorLegendRow(color: .green, label: "Correct! You got it.")
                    ColorLegendRow(color: .yellow, label: "Very close (≥70% match)")
                    ColorLegendRow(color: .orange, label: "Getting warmer (≥45%)")
                    ColorLegendRow(color: .red, label: "Cold (<45% match)")
                    ColorLegendRow(color: .purple, label: "Hint revealed")
                }

                Section("Hints") {
                    HelpRow(icon: "lightbulb.fill", color: .purple, title: "Use Hints Wisely", description: "Hints cost 1 guess each. Tap 'Get Hint' and confirm to reveal a clue.")
                }

                Section("Rules") {
                    Text("You have **6 guesses** per puzzle. A new puzzle is available each day.")
                        .font(.subheadline)
                    Text("Hints count as used guesses, so you may have fewer non-hint attempts.")
                        .font(.subheadline)
                }
            }
            .navigationTitle("How to Play")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct HelpRow: View {
    let icon: String
    let color: Color
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).fontWeight(.semibold)
                Text(description).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

private struct ColorLegendRow: View {
    let color: Color
    let label: String

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 4)
                .fill(color)
                .frame(width: 24, height: 24)
            Text(label)
                .font(.subheadline)
        }
    }
}
