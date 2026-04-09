import SwiftUI

struct GameOverSheet: View {
    @Bindable var viewModel: GameViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var cardImage: UIImage?

    var body: some View {
        ZStack {
            AppColors.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    // Shareable card (rendered to image for sharing)
                    shareableCard
                        .padding(.horizontal, 20)
                        .padding(.top, 16)

                    // Answer reveal (below the card, not in shareable)
                    if let answer = viewModel.answer {
                        VStack(spacing: 4) {
                            Text("The answer was")
                                .font(.caption)
                                .foregroundStyle(AppColors.textSecondary)
                            Text(answer)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppColors.textPrimary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.horizontal, 20)
                    }

                    // Action buttons
                    VStack(spacing: 12) {
                        // Share image
                        Button {
                            shareResult()
                        } label: {
                            Label("Share", systemImage: "square.and.arrow.up")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(AppColors.accent)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        // Share text only
                        ShareLink(item: viewModel.shareText()) {
                            Label("Share as Text", systemImage: "doc.on.doc")
                                .font(.subheadline.weight(.medium))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(AppColors.card)
                                .foregroundStyle(AppColors.textPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(AppColors.cardBorder, lineWidth: 1)
                                )
                        }

                        // Source link
                        if let sourceUrl = viewModel.sourceUrl, let url = URL(string: sourceUrl) {
                            Link(destination: url) {
                                Label("View Source Data", systemImage: "link")
                                    .font(.subheadline.weight(.medium))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(AppColors.card)
                                    .foregroundStyle(AppColors.textSecondary)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(AppColors.cardBorder, lineWidth: 1)
                                    )
                            }
                        }

                        Button("Done") { dismiss() }
                            .font(.subheadline)
                            .foregroundStyle(AppColors.textSecondary)
                            .padding(.top, 8)
                    }
                    .padding(.horizontal, 20)

                    Spacer(minLength: 32)
                }
            }
        }
    }

    // MARK: - Shareable Card

    @ViewBuilder
    private var shareableCard: some View {
        VStack(spacing: 16) {
            // Header
            Text("CAN YOU GUESS THE MAP?")
                .font(.caption.smallCaps().weight(.bold))
                .foregroundStyle(AppColors.textSecondary)
                .tracking(1.5)

            // Result icon + message
            VStack(spacing: 6) {
                Text(viewModel.isSolved ? "🎉" : "😔")
                    .font(.system(size: 44))

                Text(viewModel.isSolved ? "Solved!" : "Not this time")
                    .font(.title3.bold())
                    .foregroundStyle(AppColors.textPrimary)
            }

            // Score
            if let puzzle = viewModel.puzzle {
                let guessCount = viewModel.isSolved
                    ? viewModel.attempts.filter({ !$0.isHint }).count
                    : -1

                HStack(spacing: 4) {
                    Text(guessCount > 0 ? "\(guessCount)" : "X")
                        .font(.system(size: 36, weight: .bold).monospacedDigit())
                        .foregroundStyle(viewModel.isSolved ? .green : .red)
                    Text("/ \(puzzle.maxGuesses)")
                        .font(.system(size: 24, weight: .medium).monospacedDigit())
                        .foregroundStyle(AppColors.textSecondary)
                }
            }

            // Emoji grid row
            HStack(spacing: 6) {
                ForEach(Array(viewModel.attempts.enumerated()), id: \.offset) { _, attempt in
                    let tier = similarityTier(
                        for: attempt,
                        threshold: viewModel.puzzle?.similarityThreshold ?? 0.95
                    )
                    RoundedRectangle(cornerRadius: 4)
                        .fill(attempt.isHint ? AppColors.accent : tier.color)
                        .frame(width: 32, height: 32)
                        .overlay(
                            Text(attempt.isHint ? "💡" : "")
                                .font(.caption2)
                        )
                        .accessibilityLabel(attempt.isHint ? "Hint" : "Guess")
                }

                // Empty remaining slots
                if let puzzle = viewModel.puzzle {
                    let remaining = puzzle.maxGuesses - viewModel.attempts.count
                    ForEach(0..<max(remaining, 0), id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.white.opacity(0.08))
                            .frame(width: 32, height: 32)
                    }
                }
            }

            // Date
            Text(viewModel.puzzle?.id ?? "")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(AppColors.textSecondary.opacity(0.6))
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(AppColors.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(AppColors.cardBorder, lineWidth: 1)
        )
    }

    // MARK: - Share

    @MainActor
    private func shareResult() {
        // Render the card to an image
        let renderer = ImageRenderer(content:
            shareableCard
                .frame(width: 350)
                .padding(20)
                .background(AppColors.background)
        )
        renderer.scale = 3.0

        var items: [Any] = [viewModel.shareText()]
        if let image = renderer.uiImage {
            items.insert(image, at: 0)
        }

        let activityVC = UIActivityViewController(
            activityItems: items,
            applicationActivities: nil
        )

        // Find the topmost presented view controller for proper presentation
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            var topVC = rootVC
            while let presented = topVC.presentedViewController {
                topVC = presented
            }
            // iPad popover anchor
            activityVC.popoverPresentationController?.sourceView = topVC.view
            activityVC.popoverPresentationController?.sourceRect = CGRect(
                x: topVC.view.bounds.midX, y: topVC.view.bounds.midY, width: 0, height: 0
            )
            topVC.present(activityVC, animated: true)
        }
    }
}
