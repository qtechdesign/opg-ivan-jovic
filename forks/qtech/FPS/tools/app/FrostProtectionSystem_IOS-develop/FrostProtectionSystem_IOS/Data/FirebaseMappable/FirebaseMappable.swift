//
//  FirebaseMappable.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 8/29/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import ObjectMapper
import Firebase

extension BaseMappable {
    
    static var firebaseIdKey: String {
        get {
            return "FirebaseIdKey"
        }
    }
    
    init?(snapshot: DataSnapshot) {
        guard var json = snapshot.value as? [String: Any] else { return nil }
        json[Self.firebaseIdKey] = snapshot.key
        self.init(JSON: json)
    }
    
    init?(firebaseDict: Dictionary<String, Any>?) {
        guard let firebaseDict = firebaseDict,
            var json = firebaseDict.values.first as? [String: Any] else { return nil }
        json[Self.firebaseIdKey] = firebaseDict.keys.first as Any
        self.init(JSON: json)
    }
}

extension Mapper {
    
    func mapArray(snapshot: DataSnapshot) -> [N] {
        return snapshot.children.map({ (child) -> N? in
            if let childSnapshot = child as? DataSnapshot {
                return N(snapshot: childSnapshot)
            }
            return nil
        }).compactMap({ $0 })
    }
    
    func mapArray(firebaseDict: [String: Any]?) -> [N] {
        guard let firebaseDict = firebaseDict else {
            return []
        }
        return firebaseDict.map({ (dict) -> N? in
            return N(firebaseDict: [dict.key: dict.value])
        }).compactMap({ $0 })
    }
}
