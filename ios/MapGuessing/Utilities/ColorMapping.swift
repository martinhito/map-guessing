import SwiftUI

enum SimilarityTier {
    case correct     // is_correct = true
    case veryHigh    // >= threshold (nearly correct)
    case high        // >= 0.70
    case medium      // >= 0.45
    case low         // < 0.45
    case hint        // isHint = true

    var color: Color {
        switch self {
        case .correct: return .green
        case .veryHigh: return Color(red: 0.13, green: 0.7, blue: 0.3)
        case .high: return .yellow
        case .medium: return .orange
        case .low: return .red
        case .hint: return .purple
        }
    }

    var emoji: String {
        switch self {
        case .correct: return "🟩"
        case .veryHigh: return "🟩"
        case .high: return "🟨"
        case .medium: return "🟧"
        case .low: return "🟥"
        case .hint: return "🟪"
        }
    }
}

func similarityTier(for attempt: Attempt, threshold: Double = 0.95) -> SimilarityTier {
    if attempt.isHint { return .hint }
    if attempt.correct { return .correct }
    if attempt.similarity >= threshold { return .veryHigh }
    if attempt.similarity >= 0.70 { return .high }
    if attempt.similarity >= 0.45 { return .medium }
    return .low
}
