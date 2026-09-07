import Foundation

public final class ProgressStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private let key = "polyfit.progress"

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func load() -> Progress {
        guard let data = defaults.data(forKey: key),
              let progress = try? JSONDecoder().decode(Progress.self, from: data) else { return Progress() }
        return progress
    }

    @discardableResult
    public func save(_ progress: Progress) -> Bool {
        guard let data = try? JSONEncoder().encode(progress) else { return false }
        defaults.set(data, forKey: key)
        return true
    }
}
