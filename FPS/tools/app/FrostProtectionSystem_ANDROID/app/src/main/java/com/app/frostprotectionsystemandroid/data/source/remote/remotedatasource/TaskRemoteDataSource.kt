package com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource

import com.app.frostprotectionsystemandroid.data.model.Task
import com.app.frostprotectionsystemandroid.data.source.datasource.TaskDataSource
import com.app.frostprotectionsystemandroid.data.source.remote.network.ApiClient
import com.app.frostprotectionsystemandroid.data.source.remote.network.ApiService
import io.reactivex.Observable
import io.reactivex.Single
import retrofit2.Response

/**
 *
 */
class TaskRemoteDataSource(private val apiService: ApiService = ApiClient.getInstance().service) : TaskDataSource {

    override fun getListTask(): Observable<List<Task>> = apiService.getTasks()

    override fun createTask(task: Task): Single<Task> = apiService.createTask(task)

    override fun getTaskDetail(id: Int): Single<Task> = apiService.getTaskDetail(id)

    override fun editTask(id: Int, task: Task): Single<Task> = apiService.editTask(id, task)

    override fun deleteTask(id: Int): Single<Response<Unit>> = apiService.deleteTask(id)
}
