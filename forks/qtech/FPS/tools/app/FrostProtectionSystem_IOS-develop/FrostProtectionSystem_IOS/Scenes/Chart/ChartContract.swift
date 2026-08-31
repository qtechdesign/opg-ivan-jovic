//
//  ChartViewContract.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/24/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation

protocol ChartIView: class, BaseIView {
    func requestDatasSuccess(chartDatas: [Double])
}

protocol ChartPresenter {
    func requestDatas(deviceID: String, startDate: Date, endDate: Date, type: DeviceData.DeviceDataType)
}
