import SwiftUI

struct GameView: View {
    @Bindable var viewModel: GameViewModel

    var body: some View {
        ZStack {
            AppColors.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 16) {
                    headerView
                        .padding(.horizontal, 16)
                        .padding(.top, 8)

                    // Map card
                    if let puzzle = viewModel.puzzle {
                        MapImageView(imageURL: puzzle.imageURL)
                            .padding(.horizontal, 16)
                    }

                    // Input (only if game is active)
                    if !viewModel.isGameOver {
                        GuessInputView(viewModel: viewModel)
                            .padding(.horizontal, 16)
                    } else {
                        Button {
                            viewModel.showGameOver = true
                        } label: {
                            Label("See Results", systemImage: "checkmark.seal.fill")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(AppColors.accent)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .padding(.horizontal, 16)
                    }

                    // Guess slots (attempts + hint slot + empties)
                    GuessSlots(
                        viewModel: viewModel,
                        attempts: viewModel.attempts,
                        maxGuesses: viewModel.puzzle?.maxGuesses ?? Config.maxGuesses,
                        threshold: viewModel.puzzle?.similarityThreshold ?? 0.95,
                        guidedHint: viewModel.guidedHint
                    )
                    .padding(.horizontal, 16)
                    .animation(.spring(duration: 0.35), value: viewModel.attempts.count)

                    // Error banner
                    if let error = viewModel.errorMessage {
                        errorBanner(error)
                            .padding(.horizontal, 16)
                    }

                    Spacer(minLength: 32)
                }
                .padding(.bottom, 16)
            }
        }
        .sheet(isPresented: $viewModel.showGameOver) {
            GameOverSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $viewModel.showHelp) {
            HelpSheet()
        }
        .sheet(isPresented: $viewModel.showProfile) {
            ProfileView()
        }
    }

    // MARK: - Header

    private var headerView: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Can You Guess the Map?")
                    .font(.title3.bold())
                    .foregroundStyle(AppColors.textPrimary)
                Text("A DAILY MAP GUESSING GAME")
                    .font(.caption.smallCaps())
                    .foregroundStyle(AppColors.textSecondary)
                    .tracking(0.8)
            }
            Spacer()
            Button {
                viewModel.showProfile = true
            } label: {
                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(AppColors.textPrimary)
                    .frame(width: 34, height: 34)
                    .background(AppColors.card)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(AppColors.cardBorder, lineWidth: 1))
            }
            Button {
                viewModel.showHelp = true
            } label: {
                Text("?")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(AppColors.textPrimary)
                    .frame(width: 34, height: 34)
                    .background(AppColors.card)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(AppColors.cardBorder, lineWidth: 1))
            }
        }
    }

    // MARK: - Error Banner

    @ViewBuilder
    private func errorBanner(_ message: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.circle")
            Text(message)
                .font(.footnote)
            Spacer()
            Button("Dismiss") { viewModel.errorMessage = nil }
                .font(.footnote)
        }
        .padding(10)
        .background(Color.red.opacity(0.15))
        .foregroundStyle(.red)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Guess Slots

private struct GuessSlots: View {
    @Bindable var viewModel: GameViewModel
    let attempts: [Attempt]
    let maxGuesses: Int
    let threshold: Double
    var guidedHint: String? = nil

    private var canShowHint: Bool {
        guard let puzzle = viewModel.puzzle else { return false }
        // Can't hint on last guess, and must have hints available
        return !viewModel.isGameOver
            && viewModel.remainingGuesses > 1
            && viewModel.hints.count < puzzle.hintsAvailable
    }

    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<maxGuesses, id: \.self) { index in
                if index < attempts.count {
                    FilledSlot(
                        attempt: attempts[index],
                        index: index,
                        threshold: threshold,
                        guidedHint: index == attempts.count - 1 ? guidedHint : nil
                    )
                } else if index == attempts.count && canShowHint {
                    // First empty slot becomes the hint button
                    HintSlot(viewModel: viewModel)
                } else {
                    EmptySlot()
                }
            }
        }
    }
}

private struct EmptySlot: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(AppColors.card)
            .frame(height: 52)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(AppColors.cardBorder, lineWidth: 1)
            )
    }
}

private struct HintSlot: View {
    @Bindable var viewModel: GameViewModel

    var body: some View {
        Button {
            viewModel.showHintConfirmation = true
        } label: {
            HStack(spacing: 6) {
                if viewModel.isRequestingHint {
                    ProgressView()
                        .tint(AppColors.accent)
                        .scaleEffect(0.8)
                }
                Text("or 💡 Spend a guess to get a hint")
                    .font(.subheadline)
                    .foregroundStyle(AppColors.accent)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(AppColors.accent.opacity(0.07))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(style: StrokeStyle(lineWidth: 1.5, dash: [6, 3]))
                    .foregroundStyle(AppColors.accent)
            )
        }
        .disabled(viewModel.isRequestingHint)
        .confirmationDialog(
            "Use a hint?",
            isPresented: $viewModel.showHintConfirmation,
            titleVisibility: .visible
        ) {
            Button("Get Hint (costs 1 guess)", role: .destructive) {
                Task { await viewModel.requestHint() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("A hint will use one of your remaining guesses.")
        }
    }
}

private struct FilledSlot: View {
    let attempt: Attempt
    let index: Int
    let threshold: Double
    var guidedHint: String? = nil

    private var tier: SimilarityTier { similarityTier(for: attempt, threshold: threshold) }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    if attempt.isHint {
                        Label(attempt.guess, systemImage: "lightbulb.fill")
                            .font(.subheadline)
                            .foregroundStyle(AppColors.accent)
                            .lineLimit(1)
                    } else {
                        Text(attempt.guess)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(AppColors.textPrimary)
                            .lineLimit(1)
                    }
                    Spacer()
                    if !attempt.isHint {
                        Text("\(Int(attempt.similarity * 100))%")
                            .font(.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(tier.color)
                    }
                }

                if !attempt.isHint {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.white.opacity(0.08))
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                            Capsule()
                                .fill(tier.color)
                                .frame(width: geo.size.width * CGFloat(attempt.similarity), height: geo.size.height)
                                .animation(
                                    .spring(duration: 0.5).delay(Double(index) * 0.05),
                                    value: attempt.similarity
                                )
                        }
                    }
                    .frame(height: 4)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)

            if let hint = guidedHint {
                Divider()
                    .background(Color.white.opacity(0.08))
                HStack(alignment: .top, spacing: 6) {
                    Text("💡")
                        .font(.caption)
                    Text(hint)
                        .font(.caption)
                        .foregroundStyle(AppColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(AppColors.card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(
                    attempt.correct ? tier.color.opacity(0.5) : AppColors.cardBorder,
                    lineWidth: 1
                )
        )
        .transition(.asymmetric(
            insertion: .move(edge: .top).combined(with: .opacity),
            removal: .opacity
        ))
    }
}
