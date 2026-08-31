//
//  ChartPresenter.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/24/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import Foundation
import RxSwift

class ChartPresenterImpl: ChartPresenter {
    
    private weak var view: ChartIView!
    private let userRepository: UserRepository
    private let deviceRepository: DeviceRepository
    
    private var disposeBag = DisposeBag()
    
    init(view: ChartIView, userRepository: UserRepository, deviceRepository: DeviceRepository) {
        self.view = view
        self.deviceRepository = deviceRepository
        self.userRepository = userRepository
    }
    
    func requestDatas(deviceID: String, startDate: Date, endDate: Date, type: DeviceData.DeviceDataType) {
        self.view.showLoadingProgress()
        deviceRepository.requestListData(deviceID: deviceID, startDate: startDate, endDate: endDate)
            .map({ [weak self] (deviceDatas) -> [Double] in
                self?.getDataForChart(deviceDatas: deviceDatas, type: type) ?? []
            })
            .subscribeOn(Scheduler.shared.backgroundScheduler())
            .observeOn(Scheduler.shared.mainScheduler())
            .subscribe(onSuccess: { [weak self] (chartDatas) in
                self?.view.hideLoadingProgress()
                self?.view.requestDatasSuccess(chartDatas: chartDatas)
            }) { [weak self] (error) in
                self?.view.hideLoadingProgress()
                self?.view.showError(error: error)
            }.disposed(by: disposeBag)
    }
    
    private func getDataForChart(deviceDatas: [DeviceData], type: DeviceData.DeviceDataType) -> [Double] {
        var values = [Double]()
        let deviceDatas = deviceDatas.sorted(by: { $0.timestamp ?? 0 < $1.timestamp ?? 0 })
        switch type {
        case .windSpeed:
            values = deviceDatas.compactMap({ $0.windSpeed }).map({ Double($0) })
        case .windDirection:
            values = deviceDatas.compactMap({ $0.windDirection }).map({ Double($0) })
        case .airPressure:
            values = deviceDatas.compactMap({ $0.airPressure }).map({ Double($0) })
        case .waterPressure:
            values = deviceDatas.compactMap({ $0.waterPressure }).map({ Double($0) })
        case .temp1:
            values = deviceDatas.compactMap({ $0.temp1 }).map({ Double($0) })
        case .temp2:
            values = deviceDatas.compactMap({ $0.temp2 }).map({ Double($0) })
        case .humidity:
            values = deviceDatas.compactMap({ $0.humidity }).map({ Double($0) })
        case .soilMoisture:
            values = deviceDatas.compactMap({ $0.soilMoisture }).map({ Double($0) })
        case .battery:
            values = deviceDatas.compactMap({ $0.battery }).map({ Double($0) })
        }
        return values
    }
}


class Scheduler {
    private init() { }
    static let shared = Scheduler()
    
    func mainScheduler() -> MainScheduler {
        return MainScheduler.instance
    }
    
    func backgroundScheduler() -> ConcurrentDispatchQueueScheduler {
        return ConcurrentDispatchQueueScheduler(qos: .background)
    }
    
    func runInBackgroundThread(_ closure: @escaping (()->Void)) {
        DispatchQueue.global(qos: .background).async {
            closure()
        }
    }
    
    func runInMainThread(_ closure: @escaping (()->Void)) {
        DispatchQueue.main.async {
            closure()
        }
    }
}
