//
//  DictionaryExtension.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/16/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

extension Dictionary {
    mutating func append(dictionary: Dictionary) {
        for dic in dictionary {
            self[dic.key] = dic.value
        }
    }
    
    func printPrettyJson() {
        if let theJSONData = try? JSONSerialization.data(withJSONObject: self, options: .prettyPrinted),
            let theJSONText = String(data: theJSONData, encoding: String.Encoding.ascii) {
            print("Pretty json: ",theJSONText)
        } else {
            print("Cannot printed pretty json")
        }
    }
    
    func notContains(where predicate: (Key, Value) throws -> Bool) rethrows -> Bool {
        for item in self {
            if try predicate(item.key, item.value) {
                return false
            }
        }
        return true
    }
    
    func notContains(where predicate: (Key) throws -> Bool) rethrows -> Bool {
        for item in self {
            if try predicate(item.key) {
                return false
            }
        }
        return true
    }
    
    var jsonStringRepresentation: String? {
        guard let theJSONData = try? JSONSerialization.data(withJSONObject: self) else { return nil }
        return String(data: theJSONData, encoding: .utf8)
    }
}
