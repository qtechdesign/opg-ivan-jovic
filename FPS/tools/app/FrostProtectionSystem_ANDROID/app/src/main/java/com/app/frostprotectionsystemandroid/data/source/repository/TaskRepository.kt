package com.app.frostprotectionsystemandroid.data.source.repository

import com.app.frostprotectionsystemandroid.data.model.Task
import com.app.frostprotectionsystemandroid.data.source.datasource.TaskDataSource
import com.app.frostprotectionsystemandroid.data.source.remote.remotedatasource.TaskRemoteDataSource
import io.reactivex.Observable
import io.reactivex.Single
import retrofit2.Response

/**
 *
 */
class TaskRepository : TaskDataSource {

    private val taskRemoteDataSource: TaskRemoteDataSource =
        TaskRemoteDataSource()

    override fun getListTask(): Observable<List<Task>> = taskRemoteDataSource.getListTask()

    override fun createTask(task: Task): Single<Task> = taskRemoteDataSource.createTask(task)

    override fun getTaskDetail(id: Int): Single<Task> = taskRemoteDataSource.getTaskDetail(id)

    override fun editTask(id: Int, task: Task): Single<Task> = taskRemoteDataSource.editTask(id, task)

    override fun deleteTask(id: Int): Single<Response<Unit>> = taskRemoteDataSource.deleteTask(id)
}
