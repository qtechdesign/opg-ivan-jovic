//
//  AddGatewayContract.swift
//  
//
//  Created by TiepNguyen on 9/18/19.
//

import Foundation

protocol AddGatewayIView: class, BaseIView {
    func invalidate(error: String)
    func addNewGatewaySuccess()
}

protocol AddGatewayPresenter {
    func addNewGateway(name: String, serialKey: String, lat: String, long: String)
}
