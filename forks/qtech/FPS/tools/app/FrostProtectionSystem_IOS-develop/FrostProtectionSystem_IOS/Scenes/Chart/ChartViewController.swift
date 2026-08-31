//
//  ChartViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/23/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit
import Charts

class ChartViewController: BaseUIViewController {

    @IBOutlet weak var lineChartView: LineChartView!
    
    private var startDateBarButtonItem: UIBarButtonItem!
    private var endDateBarButtonItem: UIBarButtonItem!
    
    private var presenter: ChartPresenter!
    private var navigator: ChartNavigator!
    
    private var datas = [DeviceData]()
    private var deviceID: String!
    private var type: DeviceData.DeviceDataType = .temp1
    private var startDate = Date.date(from: Date(), hour: 0, minute: 0)
    private var endDate = Date()
    private var isTouchSelectStartDate: Bool = false
    private var isTouchSelectEndDate: Bool = false
    
    
    static func create(deviceID: String) -> UIViewController {
        let viewController: ChartViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.deviceID = deviceID
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        presenter = ChartPresenterImpl(view: self, userRepository: UserRepositoryImpl.shared, deviceRepository: DeviceRepositoryImpl.shared)
        navigator = ChartNavigatorImpl(viewController: self)
        setupOrientationDeivce()
        setupUI()
        requestData()
    }
    
    private func setupOrientationDeivce() {
        if UIDevice.current.orientation == UIDeviceOrientation.portrait {
            let value = UIInterfaceOrientation.landscapeLeft.rawValue
            UIDevice.current.setValue(value, forKey: "orientation")
        }
    }
    
    private func setupUI() {
        let selectTypeChartBarButtonItem = UIBarButtonItem(image: #imageLiteral(resourceName: "ic_more_options.pdf"), style: .plain, target: self, action: #selector(didTouchSelectTypeChart))
        startDateBarButtonItem = UIBarButtonItem(title: Strings.Chart.start(date: startDate.toDateTimeString()), style: .plain, target: self, action: #selector(didTouchSelectStartDate))
        endDateBarButtonItem = UIBarButtonItem(title: Strings.Chart.end(date: endDate.toDateTimeString()), style: .plain, target: self, action: #selector(didTouchSelectEndDate))
        let leftBarButtonItems: [UIBarButtonItem] = [startDateBarButtonItem]
        let rightBarButtonItems: [UIBarButtonItem] = [selectTypeChartBarButtonItem] + [endDateBarButtonItem]
        self.navigationItem.leftItemsSupplementBackButton = true
        navigationItem.leftBarButtonItems = leftBarButtonItems
        navigationItem.rightBarButtonItems = rightBarButtonItems
    }
    
    private func requestData() {
        presenter.requestDatas(deviceID: deviceID, startDate: startDate, endDate: endDate, type: type)
    }
    
    @objc private func didTouchSelectTypeChart() {
        let alert = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)
        for type in DeviceData.DeviceDataType.allCases {
            let action = UIAlertAction(title: type.localize(), style: self.type == type ? .destructive : .default, handler: { [weak self] _ in
                self?.type = type
                self?.requestData()
                self?.setupUI()
            })
            alert.addAction(action)
        }
        let cancel = UIAlertAction(title: Strings.Main.cancel, style: .cancel, handler: nil)
        alert.addAction(cancel)
        present(alert, animated: true, completion: nil)
    }
    
    @objc private func didTouchSelectStartDate() {
        isTouchSelectStartDate = true
        navigator.showDatePickerScreen(chooseDate: startDate, delegate: self)
    }
    
    @objc private func didTouchSelectEndDate() {
        isTouchSelectEndDate = true
        navigator.showDatePickerScreen(chooseDate: endDate, delegate: self)
    }
    
    deinit {
        let value = UIInterfaceOrientation.portrait.rawValue
        UIDevice.current.setValue(value, forKey: "orientation")
    }
}

extension ChartViewController: DatePickerDelegate {
    
    func didPickDate(date: Date) {
        if isTouchSelectStartDate {
            startDate = date
        } else if isTouchSelectEndDate {
            endDate = date
        }
        isTouchSelectStartDate = false
        isTouchSelectEndDate = false
        requestData()
    }
}

// MARK: - Draw chart
extension ChartViewController {
    
    private func drawChart(chartDatas: [Double]) {
        guard !chartDatas.isEmpty else {
            lineChartView.data = nil
            return
        }
        let values = (0..<chartDatas.count).map { (i) -> ChartDataEntry in
            let val = chartDatas[i]
            return ChartDataEntry(x: Double(i), y: Double(val))
        }
        let set1 = LineChartDataSet(entries: values, label: type.localize())
        set1.mode = .cubicBezier
        set1.drawIconsEnabled = false
        set1.setColor(ColorUtils.colorPrimaryStatusBar)
        set1.setCircleColor(.black)
        set1.lineWidth = 1
        set1.circleRadius = 3
        set1.drawCircleHoleEnabled = true
        set1.valueFont = .systemFont(ofSize: 9)
        set1.formLineDashLengths = [5, 2.5]
        set1.formLineWidth = 1
        set1.formSize = 15
        
        let xAxis = lineChartView.xAxis
        xAxis.labelFont = .systemFont(ofSize: 11)
        xAxis.labelTextColor = .white
        xAxis.drawAxisLineEnabled = false
        let data = LineChartData(dataSets: [set1])
        lineChartView.data = data
    }
}

extension ChartViewController: ChartIView {
    
    func requestDatasSuccess(chartDatas: [Double]) {
        setupUI()
        drawChart(chartDatas: chartDatas)
    }
    
    func showLoadingProgress() {
        showLoadingInsideView()
    }
    
    func hideLoadingProgress() {
        hideLoadingInsideView()
    }
    
    func showError(error: Error) {
        self.showErrorAlert(error.localizedDescription)
    }
}
