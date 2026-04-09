import SwiftUI

struct ContentView: View {
    @State private var viewModel = GameViewModel()

    var body: some View {
        Group {
            if viewModel.isLoading {
                LoadingView()
            } else if !viewModel.networkAvailable {
                ErrorView(message: "No Internet Connection", systemImage: "wifi.slash") {
                    Task { await viewModel.loadGame() }
                }
            } else if let error = viewModel.errorMessage, viewModel.puzzle == nil {
                ErrorView(message: error, systemImage: "exclamationmark.triangle") {
                    Task { await viewModel.loadGame() }
                }
            } else {
                GameView(viewModel: viewModel)
            }
        }
        .preferredColorScheme(.dark)
        .task {
            await viewModel.loadGame()
        }
    }
}

private struct LoadingView: View {
    var body: some View {
        ZStack {
            AppColors.background.ignoresSafeArea()
            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.white)
                Text("Loading today's puzzle...")
                    .foregroundStyle(AppColors.textSecondary)
                    .font(.subheadline)
            }
        }
    }
}
