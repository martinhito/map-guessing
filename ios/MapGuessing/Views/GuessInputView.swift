import SwiftUI

struct GuessInputView: View {
    @Bindable var viewModel: GameViewModel
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 10) {
            TextField("What does this map show?", text: $viewModel.guessText)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .focused($focused)
                .submitLabel(.send)
                .onSubmit {
                    Task { await viewModel.submitGuess() }
                }
                .disabled(viewModel.isSubmitting || viewModel.isGameOver)
                .foregroundStyle(AppColors.textPrimary)
                .tint(AppColors.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 14)
                .background(AppColors.card)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(focused ? AppColors.accent.opacity(0.5) : AppColors.cardBorder, lineWidth: 1)
                )

            Button {
                Task { await viewModel.submitGuess() }
            } label: {
                Group {
                    if viewModel.isSubmitting {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: 48, height: 48)
                .background(AppColors.accent)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(
                viewModel.guessText.trimmingCharacters(in: .whitespaces).isEmpty ||
                viewModel.isSubmitting ||
                viewModel.isGameOver
            )
        }
    }
}
