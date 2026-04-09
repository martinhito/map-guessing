import SwiftUI
import Observation

@Observable
@MainActor
final class GameViewModel {
    // MARK: - State
    var puzzle: Puzzle?
    var attempts: [Attempt] = []
    var hints: [String] = []
    var guessText: String = ""

    var isSolved: Bool = false
    var isGameOver: Bool = false
    var answer: String?
    var sourceUrl: String?
    var remainingGuesses: Int = Config.maxGuesses

    var isLoading: Bool = false
    var isSubmitting: Bool = false
    var isRequestingHint: Bool = false
    var errorMessage: String?
    var networkAvailable: Bool = true

    var showGameOver: Bool = false
    var showHelp: Bool = false
    var showHintConfirmation: Bool = false
    var showProfile: Bool = false

    var currentStreak: Int = 0
    var maxStreak: Int = 0

    var guidedHint: String? = nil

    // MARK: - Load

    func loadGame() async {
        isLoading = true
        errorMessage = nil

        // Connectivity check
        networkAvailable = await APIClient.shared.checkHealth()
        guard networkAvailable else {
            isLoading = false
            errorMessage = "No internet connection."
            return
        }

        do {
            let p = try await PuzzleService.shared.fetchTodaysPuzzle()
            puzzle = p
            remainingGuesses = p.maxGuesses

            // Restore state from server
            let attemptsResp = try await PuzzleService.shared.fetchAttempts(puzzleID: p.id)
            attempts = attemptsResp.attempts

            if let gs = attemptsResp.gameState {
                isSolved = gs.solved
                isGameOver = gs.solved || (gs.totalGuesses >= p.maxGuesses)
                remainingGuesses = max(0, p.maxGuesses - gs.totalGuesses)
            }

            if let ans = attemptsResp.answer {
                answer = ans
            }
            if let src = attemptsResp.sourceUrl {
                sourceUrl = src
            }

            // Fetch revealed hints
            if attempts.contains(where: { $0.isHint }) {
                let hintsResp = try await HintService.shared.fetchAllHints(puzzleID: p.id)
                hints = hintsResp.hints
            }

            if isGameOver {
                showGameOver = true
            }

            // Load streak (best-effort)
            await loadStreak()

        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func submitGuess() async {
        guard let puzzle, !guessText.trimmingCharacters(in: .whitespaces).isEmpty, !isSubmitting else { return }

        let text = guessText.trimmingCharacters(in: .whitespaces)
        isSubmitting = true
        guessText = ""
        guidedHint = nil

        do {
            let response = try await PuzzleService.shared.submitGuess(puzzleID: puzzle.id, guess: text)

            let attempt = Attempt(
                guess: text,
                similarity: response.similarity,
                correct: response.correct,
                timestamp: ISO8601DateFormatter().string(from: Date()),
                isHint: false
            )

            withAnimation(.spring(duration: 0.3)) {
                attempts.append(attempt)
            }

            remainingGuesses = response.remainingGuesses
            guidedHint = response.guidedHint

            if response.correct {
                isSolved = true
                isGameOver = true
                answer = response.answer
                sourceUrl = response.sourceUrl
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                try? await Task.sleep(nanoseconds: 600_000_000)
                showGameOver = true
            } else if response.gameOver {
                isGameOver = true
                answer = response.answer
                sourceUrl = response.sourceUrl
                try? await Task.sleep(nanoseconds: 600_000_000)
                showGameOver = true
            }

        } catch let error as APIError {
            errorMessage = error.errorDescription
            guessText = text // restore so user can retry
        } catch {
            errorMessage = error.localizedDescription
            guessText = text
        }

        isSubmitting = false
    }

    func requestHint() async {
        guard let puzzle, !isRequestingHint, remainingGuesses > 1 else { return }

        isRequestingHint = true

        do {
            let response = try await HintService.shared.fetchNextHint(puzzleID: puzzle.id)

            // Add hint as a special attempt
            let hintAttempt = Attempt(
                guess: response.hintText,
                similarity: 0,
                correct: false,
                timestamp: ISO8601DateFormatter().string(from: Date()),
                isHint: true
            )

            withAnimation(.spring(duration: 0.3)) {
                attempts.append(hintAttempt)
                hints.append(response.hintText)
            }

            remainingGuesses = response.remainingGuesses

            if response.gameOver {
                isGameOver = true
                showGameOver = true
            }

        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }

        isRequestingHint = false
    }

    // MARK: - Streak

    private func loadStreak() async {
        do {
            let streak = try await PuzzleService.shared.fetchStreak()
            currentStreak = streak.currentStreak
            maxStreak = streak.maxStreak
        } catch {
            // Streak endpoint not yet implemented — compute locally
            let solved = attempts.contains(where: { $0.correct })
            currentStreak = solved ? 1 : 0
            maxStreak = solved ? 1 : 0
        }
    }

    // MARK: - Share

    func shareText() -> String {
        guard let puzzle else { return "" }
        return buildShareText(
            puzzleID: puzzle.id,
            attempts: attempts,
            threshold: puzzle.similarityThreshold,
            solved: isSolved
        )
    }
}
