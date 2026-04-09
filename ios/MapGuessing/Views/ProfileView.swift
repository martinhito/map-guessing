import SwiftUI

struct ProfileView: View {
    @State private var stats: PlayerStats = .empty
    @State private var isLoading = true
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            AppColors.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Your Stats")
                                .font(.title2.bold())
                                .foregroundStyle(AppColors.textPrimary)
                            Text("ALL TIME")
                                .font(.caption.smallCaps())
                                .foregroundStyle(AppColors.textSecondary)
                                .tracking(0.8)
                        }
                        Spacer()
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(AppColors.textSecondary)
                                .frame(width: 30, height: 30)
                                .background(AppColors.card)
                                .clipShape(Circle())
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 20)

                    if isLoading {
                        ProgressView()
                            .tint(AppColors.accent)
                            .padding(.top, 60)
                    } else if let error {
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                            .padding()
                    } else {
                        // Main stats grid
                        statsGrid
                            .padding(.horizontal, 20)

                        // Guess distribution
                        if stats.totalSolved > 0 {
                            guessDistribution
                                .padding(.horizontal, 20)
                        }

                        Spacer(minLength: 40)
                    }
                }
            }
        }
        .task {
            await loadStats()
        }
    }

    // MARK: - Stats Grid

    private var statsGrid: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                StatCard(value: "\(stats.totalPlayed)", label: "Played", icon: "🗺️")
                StatCard(value: "\(stats.totalSolved)", label: "Solved", icon: "✅")
                StatCard(
                    value: stats.totalPlayed > 0 ? "\(Int(stats.successRate * 100))%" : "–",
                    label: "Win Rate",
                    icon: "🎯"
                )
            }

            HStack(spacing: 12) {
                StatCard(value: "\(stats.currentStreak)", label: "Streak", icon: "🔥")
                StatCard(value: "\(stats.maxStreak)", label: "Best", icon: "🏆")
                StatCard(
                    value: stats.totalSolved > 0 ? String(format: "%.1f", stats.averageGuesses) : "–",
                    label: "Avg Guesses",
                    icon: "📊"
                )
            }

            HStack(spacing: 12) {
                StatCard(value: "\(stats.hintsUsed)", label: "Hints Used", icon: "💡")
                Spacer()
                Spacer()
            }
        }
    }

    // MARK: - Guess Distribution

    private var guessDistribution: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("GUESS DISTRIBUTION")
                .font(.caption.smallCaps())
                .foregroundStyle(AppColors.textSecondary)
                .tracking(0.8)

            let maxGuesses = 6
            let maxCount = stats.guessDistribution.values.max() ?? 1

            ForEach(1...maxGuesses, id: \.self) { guessNum in
                let count = stats.guessDistribution["\(guessNum)"] ?? 0
                HStack(spacing: 8) {
                    Text("\(guessNum)")
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(AppColors.textSecondary)
                        .frame(width: 14, alignment: .trailing)

                    GeometryReader { geo in
                        let width = maxCount > 0
                            ? max(CGFloat(count) / CGFloat(maxCount) * geo.size.width, count > 0 ? 30 : 4)
                            : 4

                        HStack {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(barColor(for: guessNum))
                                .frame(width: width, height: 22)
                                .overlay(alignment: .trailing) {
                                    if count > 0 {
                                        Text("\(count)")
                                            .font(.caption2.monospacedDigit().weight(.bold))
                                            .foregroundStyle(.white)
                                            .padding(.trailing, 6)
                                    }
                                }
                            Spacer()
                        }
                    }
                    .frame(height: 22)
                }
            }
        }
        .padding(16)
        .background(AppColors.card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppColors.cardBorder, lineWidth: 1)
        )
    }

    private func barColor(for guess: Int) -> Color {
        switch guess {
        case 1: return .green
        case 2: return Color(red: 0.3, green: 0.85, blue: 0.3)
        case 3: return .yellow
        case 4: return .orange
        case 5: return Color(red: 1.0, green: 0.5, blue: 0.2)
        default: return .red
        }
    }

    // MARK: - Load

    private func loadStats() async {
        do {
            stats = try await APIClient.shared.request("/api/player/stats")
            isLoading = false
        } catch {
            self.error = "Couldn't load stats"
            isLoading = false
        }
    }
}

// MARK: - Stat Card

private struct StatCard: View {
    let value: String
    let label: String
    let icon: String

    var body: some View {
        VStack(spacing: 6) {
            Text(icon)
                .font(.title3)
            Text(value)
                .font(.title3.monospacedDigit().bold())
                .foregroundStyle(AppColors.textPrimary)
            Text(label)
                .font(.caption2)
                .foregroundStyle(AppColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(AppColors.card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppColors.cardBorder, lineWidth: 1)
        )
    }
}
