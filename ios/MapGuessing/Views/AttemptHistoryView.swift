import SwiftUI

struct AttemptHistoryView: View {
    let attempts: [Attempt]
    let threshold: Double
    var guidedHint: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Guesses")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.bottom, 4)

            ForEach(Array(attempts.enumerated()), id: \.element.id) { index, attempt in
                AttemptRowView(
                    attempt: attempt,
                    threshold: threshold,
                    index: index,
                    guidedHint: index == attempts.count - 1 ? guidedHint : nil
                )
                .transition(.asymmetric(
                    insertion: .move(edge: .top).combined(with: .opacity),
                    removal: .opacity
                ))
            }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
