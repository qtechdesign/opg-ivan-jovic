//
//  DateExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/7/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

struct Formatter {
    enum APIFormat: String {
        case date = "yyyy-MM-dd"
        case dateTime = "yyyy-MM-dd HH:mm:ss"
    }
    
    enum AppFormat: String {
        case date = "yyyy-MM-dd"
        case shortDate = "MM-dd"
        case longDate = "yyyy-MMM-dd"
        case dateTime = "yyyy-MM-dd HH:mm:ss"
        case dateTimeAndMilliseconds = "yyyy-MM-dd HH:mm:ss:SSS"
        case dotDate = "yyyy.MM.dd"
        case hourMinute = "HH:mm"
        case dateTimeWithoutSecond = "yyyy-MM-dd HH:mm"
        case day = "dd"
        case month = "MM"
        
        var rawValue: String {
            get {
                switch self {
                case .date:
                    return "dd/MM/yyyy"
                case .shortDate:
                    return "dd/MM"
                case .longDate:
                    return "EEEE, dd MMMM yyyy"
                case .dateTime:
                    return "dd/MM/yyyy HH:mm:ss"
                case .dateTimeAndMilliseconds:
                    return "dd/MM/yyyy HH:mm:ss:SSS"
                case .dotDate:
                    return "yyyy.MM.dd"
                case .hourMinute:
                    return "HH:mm"
                case .dateTimeWithoutSecond:
                    return "dd/MM/yyyy HH:mm"
                case .day:
                    return "dd"
                case .month:
                    return "MM"
                }
            }
        }
    }
    
    static func defaultCalendar() -> Calendar {
        return Calendar(identifier: .gregorian)
    }
    
    static func defaultLocale() -> Locale {
        return Locale(identifier: "en_US_POSIX")
    }
    
    static let `default`: DateFormatter = { () -> DateFormatter in
        let formatter = DateFormatter()
        formatter.calendar = Formatter.defaultCalendar()
        formatter.locale = Formatter.defaultLocale()
        formatter.dateFormat = APIFormat.dateTime.rawValue
        return formatter
    }()
    
    static let dateOnly: DateFormatter = { () -> DateFormatter in
        let formatter = DateFormatter()
        formatter.calendar = Formatter.defaultCalendar()
        formatter.locale = Formatter.defaultLocale()
        formatter.dateFormat = APIFormat.date.rawValue
        return formatter
    }()
    
    static let timeOnly: DateFormatter = { () -> DateFormatter in
        let formatter = DateFormatter()
        formatter.calendar = Formatter.defaultCalendar()
        formatter.locale = Formatter.defaultLocale()
        formatter.dateFormat = AppFormat.hourMinute.rawValue
        return formatter
    }()
    
    static func formatter(dateFormat: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = Formatter.defaultCalendar()
        formatter.locale = Locale.current
        formatter.dateFormat = dateFormat
        return formatter
    }
    
    static func fullDateTime() -> DateFormatter {
        return Formatter.default
    }
}

extension Date {
    
    func nextDate(days:Int) -> Date {
        return Calendar(identifier: .gregorian).date(byAdding: .day, value: days, to: self)!
    }
    
    func previousDate(days: Int) -> Date {
        return Calendar(identifier: .gregorian).date(byAdding: .day, value: -days, to: self)!
    }
    
    func weekDay() -> Int {
        return Calendar(identifier: .gregorian).component(.weekday, from: self)
    }
    
    func year() -> Int {
        return Calendar(identifier: .gregorian).component(.year, from: self)
    }
    
    func month() -> Int {
        return Calendar(identifier: .gregorian).component(.month, from: self)
    }
    
    func day() -> Int {
        return Calendar(identifier: .gregorian).component(.day, from: self)
    }
    
    func hour() -> Int {
        return Calendar(identifier: .gregorian).component(.hour, from: self)
    }
    
    func minute() -> Int {
        return Calendar(identifier: .gregorian).component(.minute, from: self)
    }
    
    func second() -> Int {
        return Calendar(identifier: .gregorian).component(.second, from: self)
    }
    
    func minutesFrom(date: Date) -> Int {
        return Calendar.current.dateComponents([.minute], from: date, to: self).minute ?? 0
    }
    
    func hoursFrom(date: Date) -> Int {
        return Calendar.current.dateComponents([.hour], from: date, to: self).hour ?? 0
    }
    
    func daysFrom(date: Date) -> Int {
        return Calendar.current.dateComponents([.day], from: date, to: self).day ?? 0
    }
    
    func monthsFrom(date: Date) -> Int {
        return Calendar.current.dateComponents([.month], from: date, to: self).month ?? 0
    }
    
    func yearsFrom(date: Date) -> Int {
        return Calendar.current.dateComponents([.year], from: date, to: self).year ?? 0
    }
    
    func isYearDifferent(date: Date) -> Bool {
        return self.year() != date.year()
    }
    
    static func getDateMaxTime(date: Date) -> Date? {
        return Calendar.current.date(bySettingHour: 23, minute: 59, second: 59, of: date)
    }
    
    static func date(from date: Date, hour: Int, minute: Int) -> Date {
        let calendar = Calendar(identifier: .gregorian)
        var dateComponents = calendar.dateComponents([ .year, .month, .day ], from: date)
        dateComponents.hour = hour
        dateComponents.minute = minute
        dateComponents.second = 0
        
        return calendar.date(from: dateComponents) ?? Date()
    }
    
    static func date(year: Int, month: Int = 1, day: Int = 1, hour: Int = 0, minute: Int = 0, second: Int = 0) -> Date? {
        let dateComponents = DateComponents(calendar: Calendar(identifier: Calendar.Identifier.gregorian), year: year, month: month, day: day, hour: hour, minute: minute, second: second)
        
        return Calendar(identifier: .gregorian).date(from: dateComponents)
    }
    
    static func isAWeekStartOnSunday() -> Bool {
        // USA a week starts on Sunday. Calendar.current.firstWeekday => 1
        // Some country a week starts on Monday. Calendar.current.firstWeekday => 2
        return Calendar(identifier: .gregorian).firstWeekday == 1
    }
    
    static func indexSundayOfDaysInWeek() -> Int {
        let startIndexOfDaysInWeek = 1
        let endIndexOfDaysInWeek = 7
        let indexSundayOfDaysInWeek = isAWeekStartOnSunday() ? startIndexOfDaysInWeek : endIndexOfDaysInWeek
        return indexSundayOfDaysInWeek
    }
    
    static func maximumDay() -> Int {
        return 31
    }
    
    func toTimeString() -> String {
        let formatter = Formatter.formatter(dateFormat: Formatter.AppFormat.hourMinute.rawValue)
        return formatter.string(from: self)
    }
    
    func toDateString() -> String {
        let formatter = Formatter.formatter(dateFormat: Formatter.AppFormat.date.rawValue)
        return formatter.string(from: self)
    }
    
    func toDayString() -> String {
        let formatter = Formatter.formatter(dateFormat: Formatter.AppFormat.day.rawValue)
        return formatter.string(from: self)
    }
    
    func toMonthString() -> String {
        let formatter = Formatter.formatter(dateFormat: Formatter.AppFormat.month.rawValue)
        return formatter.string(from: self)
    }
    
    func toShortDateString() -> String {
        let formatter = Formatter.formatter(dateFormat: Formatter.AppFormat.shortDate.rawValue)
        return formatter.string(from: self)
    }
    
    func toLongDateString() -> String {
        let formatter = Formatter.formatter(dateFormat: Formatter.AppFormat.longDate.rawValue)
        return formatter.string(from: self)
    }
    
    func toAPIDateString() -> String {
        let formatter = Formatter.formatter(dateFormat: Formatter.APIFormat.date.rawValue)
        return formatter.string(from: self)
    }
    
    func toAPIDateTimeString() -> String {
        let formatter = Formatter.formatter(dateFormat: Formatter.APIFormat.dateTime.rawValue)
        return formatter.string(from: self)
    }
    
    func toDateTimeString() -> String {
        let formatter = Formatter.formatter(dateFormat: Formatter.AppFormat.dateTime.rawValue)
        return formatter.string(from: self)
    }
    
    func toAppDateTimeString() -> String {
        let formatter = Formatter.formatter(dateFormat: Formatter.AppFormat.dateTimeWithoutSecond.rawValue)
        return formatter.string(from: self)
    }
    
    func toString(dateFormat: String) -> String {
        let formatter = Formatter.formatter(dateFormat: dateFormat)
        return formatter.string(from: self)
    }
    
    func isEqualDateWithoutTime(date: Date) -> Bool {
        return  self.day() == date.day() && self.month() == date.month() && self.year() == date.year()
    }
    
    static func calculateDayDifferenceFromNow(_ date: Date) -> Int {
        let dateSince1970 = date.timeIntervalSince1970
        let nowSince1970 = Date().timeIntervalSince1970
        let defferenceTime = nowSince1970 - dateSince1970
        let day: Int = Int(defferenceTime) / (60*60*24)
        return day
    }
    
    static func calculateAfterTimeString(_ date: Date) -> String {
        let now = Date()
        
        let dateSince1970 = date.timeIntervalSince1970
        let nowSince1970 = now.timeIntervalSince1970
        let defferenceTime = nowSince1970 - dateSince1970
        let day: Int = Int(defferenceTime) / (60*60*24)
        
        let formatter = DateFormatter()
        formatter.dateFormat = "dd"
        
        let dateDay = formatter.string(from: date)
        let nowDay = formatter.string(from: now)
        
        switch day {
        case 0:
            if dateDay == nowDay {
                formatter.dateFormat = "HH:mm"
                return formatter.string(from: date)
            } else {
                formatter.dateFormat = "MM/dd"
                return formatter.string(from: date)
            }
        default:
            formatter.dateFormat = "MM/dd"
            return formatter.string(from: date)
        }
    }
    
    var startOfDay: Date {
        return Calendar.current.startOfDay(for: self)
    }
    
    var endOfDay: Date {
        return Date.date(from: self, hour: 23, minute: 59)
    }
    
    func isSameDate(date: Date) -> Bool {
        return self.startOfDay == date.startOfDay
    }
    
    func toTimestampMilisecond() -> UInt64 {
        return toTimestampSecond() * 1000
    }
    
    func toTimestampSecond() -> UInt64 {
        return UInt64(self.timeIntervalSince1970)
    }
    
    func toTimestampString() -> String {
        return String(toTimestampSecond())
    }
    
    static func getCurrentTimestampWithMillisecondsInt() -> Int? {
        let formatter = Formatter.formatter(dateFormat: Formatter.AppFormat.dateTimeAndMilliseconds.rawValue)
        let date = formatter.date(from: formatter.string(from: Date()))
        if var timestamp = date?.timeIntervalSince1970 {
            timestamp = timestamp * 1000
            return Int(timestamp)
        }
        return nil
    }
    
    static func getDateFromTimestamp(timestamp: UInt64?) -> Date? {
        guard var timestamp = timestamp else { return nil }
        timestamp = timestamp / 1000
        return Date(timeIntervalSince1970: TimeInterval(timestamp))
    }
}

extension TimeZone {
    func toTimeZoneString() -> String {
        let localTimeZoneFormatter = DateFormatter()
        localTimeZoneFormatter.timeZone = self
        localTimeZoneFormatter.dateFormat = "Z"
        return localTimeZoneFormatter.string(from: Date())
    }
}
