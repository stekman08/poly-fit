import XCTest

final class PolyFitUITests: XCTestCase {
    func testNativeStartScreenAndAccessiblePath() {
        let application = XCUIApplication()
        application.launch()
        XCTAssertTrue(application.staticTexts["POLYFIT"].waitForExistence(timeout: 5))
        let newGame = application.buttons["New Game"]
        XCTAssertTrue(newGame.exists)
        newGame.tap()
        XCTAssertTrue(application.staticTexts["HOW TO PLAY"].waitForExistence(timeout: 5) ||
                      application.staticTexts["LEVEL 1"].waitForExistence(timeout: 10))
    }
}
