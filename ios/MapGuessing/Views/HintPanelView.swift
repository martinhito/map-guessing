import SwiftUI

struct HintPanelView: View {
    @Bindable var viewModel: GameViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Revealed hints
            if !viewModel.hints.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(viewModel.hints.enumerated()), id: \.offset) { _, hint in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "lightbulb.fill")
                                .foregroundStyle(AppColors.accent)
                                .font(.subheadline)
                            Text(hint)
                                .font(.subheadline)
                                .foregroundStyle(AppColors.textPrimary)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(AppColors.accent.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }

            // Hint button with dashed border
            if viewModel.remainingGuesses > 1,
               let puzzle = viewModel.puzzle,
               viewModel.hints.count < puzzle.hintsAvailable {
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
                    .padding(.vertical, 13)
                    .padding(.horizontal, 16)
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
    }
}
