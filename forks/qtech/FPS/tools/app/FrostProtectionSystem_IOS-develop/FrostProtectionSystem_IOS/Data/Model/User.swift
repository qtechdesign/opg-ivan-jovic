//
//  User.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import Foundation
import ObjectMapper

class User: Mappable {
    
    var id: String = ""
    var name: String = ""
    var email: String = ""
    
    init(id: String, name: String) {
        self.id = id
        self.name = name
    }
    
    required init?(map: Map) {
    }
    
    func mapping(map: Map) {
        id <- map[User.firebaseIdKey]
        name <- map[KeyDatabase.User.name]
        email <- map[KeyDatabase.User.email]
    }
}
