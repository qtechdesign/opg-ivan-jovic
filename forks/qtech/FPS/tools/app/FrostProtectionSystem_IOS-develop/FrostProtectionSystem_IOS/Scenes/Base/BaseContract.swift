//
//  BaseContract.swift
//  BaseMVP
//
//  Created by TiepNguyen on 8/20/19.
//  Copyright © 2019 tn. All rights reserved.
//

import UIKit

protocol BaseIView {
    func showLoadingProgress()
    func hideLoadingProgress()
    func showError(error: Error)
}
