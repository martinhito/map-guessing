import Foundation

enum DateHelper {
    /// Returns today's puzzle ID in "YYYY-MM-DD" format based on US/Eastern time
    static var todayPuzzleID: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "America/New_York")
        return formatter.string(from: Date())
    }
}
