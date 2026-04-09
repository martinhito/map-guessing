import Foundation

final class PlayerService: @unchecked Sendable {
    nonisolated(unsafe) static let shared = PlayerService()
    private let key = "player_id"

    private init() {}

    var playerID: String {
        if let stored = UserDefaults.standard.string(forKey: key) {
            return stored
        }
        let newID = "p_\(UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: ""))"
        UserDefaults.standard.set(newID, forKey: key)
        return newID
    }
}
