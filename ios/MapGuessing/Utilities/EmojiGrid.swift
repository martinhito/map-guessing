import Foundation

func buildShareText(puzzleID: String, attempts: [Attempt], threshold: Double, solved: Bool) -> String {
    let nonHintAttempts = attempts.filter { !$0.isHint }
    let guessCount = solved ? "\(nonHintAttempts.count)" : "X"
    let maxGuesses = Config.maxGuesses

    let grid = attempts.map { attempt -> String in
        similarityTier(for: attempt, threshold: threshold).emoji
    }.joined()

    return """
    Can You Guess the Map? \(puzzleID)
    \(guessCount)/\(maxGuesses)

    \(grid)

    https://map-guessing-production.up.railway.app
    """
}
