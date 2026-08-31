//
//  DatePickerViewController.swift
//  FrostProtectionSystem_IOS
//
//  Created by TiepNguyen on 9/25/19.
//  Copyright © 2019 qtech. All rights reserved.
//

import UIKit

protocol DatePickerDelegate {
    func didPickDate(date: Date)
}

class DatePickerViewController: BaseUIViewController {
    
    @IBOutlet weak var datePicker: UIDatePicker!
    @IBOutlet weak var contentView: UIView!
    
    private var delegate: DatePickerDelegate?
    private var minimumDate: Date?
    private var maximumDate: Date?
    private var chooseDate: Date?
    
    static func create(minimumDate: Date? = nil, maximumDate: Date? = nil, chooseDate: Date? = nil, delegate: DatePickerDelegate) -> DatePickerViewController {
        let viewController: DatePickerViewController = UIViewController.createViewControllerFromMainStoryboard()
        viewController.delegate = delegate
        viewController.minimumDate = minimumDate
        viewController.maximumDate = maximumDate
        viewController.chooseDate = chooseDate
        return viewController
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        let tapContentGesture = UITapGestureRecognizer(target: self, action: nil)
        self.contentView.addGestureRecognizer(tapContentGesture)
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(dismissView))
        self.view.addGestureRecognizer(tapGesture)
        self.datePicker.minimumDate = self.minimumDate
        self.datePicker.maximumDate = self.maximumDate
        if let chooseDate = chooseDate {
            self.datePicker.setDate(chooseDate, animated: true)
        }
    }
    
    @objc func dismissView() {
        self.dismissWithFade()
    }
    
    @IBAction func didTapDoneButton(_ sender: Any) {
        delegate?.didPickDate(date: datePicker.date)
        self.dismissWithFade()
    }
    
    @IBAction func didTapCancelButton(_ sender: Any) {
        self.dismissWithFade()
    }
}
