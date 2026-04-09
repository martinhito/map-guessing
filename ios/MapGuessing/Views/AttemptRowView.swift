import SwiftUI

struct AttemptRowView: View {
    let attempt: Attempt
    let threshold: Double
    let index: Int
    var guidedHint: String? = nil

    private var tier: SimilarityTier { similarityTier(for: attempt, threshold: threshold) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 10) {
                // Index label
                Text("\(index + 1)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(width: 16)

                // Color bar
                RoundedRectangle(cornerRadius: 4)
                    .fill(tier.color)
                    .frame(width: barWidth, height: 28)
                    .animation(.spring(duration: 0.4).delay(Double(index) * 0.05), value: barWidth)

                // Guess text
                if attempt.isHint {
                    Label(attempt.guess, systemImage: "lightbulb.fill")
                        .font(.subheadline)
                        .foregroundStyle(.purple)
                        .lineLimit(2)
                } else {
                    Text(attempt.guess)
                        .font(.subheadline)
                        .lineLimit(1)
                }

                Spacer()

                // Score
                if !attempt.isHint {
                    Text(percentText)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(tier.color)
                        .fontWeight(.semibold)
                }
            }
            .padding(.vertical, 4)

            if let hint = guidedHint {
                GuidedHintBubble(text: hint)
                    .padding(.leading, 26)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.easeIn(duration: 0.35), value: guidedHint != nil)
    }

    private var barWidth: CGFloat {
        if attempt.isHint { return 12 }
        return max(12, CGFloat(attempt.similarity) * 160)
    }

    private var percentText: String {
        "\(Int(attempt.similarity * 100))%"
    }
}

private struct GuidedHintBubble: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            Text("💡")
                .font(.caption)
            Text(text)
                .font(.caption)
                .foregroundStyle(.primary.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
