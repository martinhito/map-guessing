import SwiftUI

struct TimelineView: View {
    let attempts: [Attempt]
    let threshold: Double

    var body: some View {
        HStack(spacing: 6) {
            ForEach(attempts) { attempt in
                let tier = similarityTier(for: attempt, threshold: threshold)
                RoundedRectangle(cornerRadius: 4)
                    .fill(tier.color)
                    .frame(width: 28, height: 28)
                    .overlay {
                        if attempt.isHint {
                            Image(systemName: "lightbulb.fill")
                                .font(.caption2)
                                .foregroundStyle(.white)
                        } else if attempt.correct {
                            Image(systemName: "checkmark")
                                .font(.caption2.bold())
                                .foregroundStyle(.white)
                        }
                    }
                    .transition(.scale.combined(with: .opacity))
            }
            Spacer()
        }
    }
}
